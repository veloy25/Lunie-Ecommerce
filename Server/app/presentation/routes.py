from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import uuid4

from authlib.integrations.base_client.errors import OAuthError
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.application.catalog import get_catalog
from app.core.settings import settings
from app.domain.commerce import ProductNotPurchasable, cart_fingerprint, price_line
from app.domain.ports import PaymentProvider, ShippingProvider
from app.infrastructure.adapters.google_oidc import create_google_oauth
from app.infrastructure.adapters.melhor_envio import MelhorEnvioAdapter
from app.infrastructure.adapters.mercadopago import MercadoPagoAdapter, ProviderUnavailable
from app.infrastructure.database import get_session
from app.infrastructure.models import (
    Address,
    AuthSession,
    Order,
    OrderItem,
    Payment,
    Product,
    Shipment,
    ShippingQuote,
    User,
    utc_now,
)
from app.infrastructure.pii import decrypt_json, encrypt_json, encrypt_value
from app.infrastructure.repositories import SqlProductRepository, SqlUserRepository
from app.presentation.schemas import AddressInput, CheckoutInput, ProductPatch, ShippingQuoteInput

router = APIRouter(prefix="/api")
payments = MercadoPagoAdapter()
shipping = MelhorEnvioAdapter()
google_oauth = create_google_oauth()


def get_payment_provider() -> PaymentProvider:
    return payments


def get_shipping_provider() -> ShippingProvider:
    return shipping


def optional_auth(request: Request, session: Session = Depends(get_session)) -> tuple[User, AuthSession] | None:
    raw_token = request.cookies.get("lunie_session")
    if not raw_token:
        return None
    digest = hashlib.sha256(raw_token.encode()).hexdigest()
    row = session.scalar(select(AuthSession).where(AuthSession.session_hash == digest, AuthSession.revoked_at.is_(None)))
    if row is None:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= utc_now():
        row.revoked_at = utc_now()
        session.commit()
        return None
    user = session.get(User, row.user_id)
    return (user, row) if user else None


def require_auth(auth: tuple[User, AuthSession] | None = Depends(optional_auth)) -> tuple[User, AuthSession]:
    if auth is None:
        raise HTTPException(status_code=401, detail="Entre para continuar.")
    return auth


def require_admin(auth: tuple[User, AuthSession] = Depends(require_auth)) -> tuple[User, AuthSession]:
    if auth[0].role != "admin":
        raise HTTPException(status_code=403, detail="Esta conta não tem acesso administrativo.")
    return auth


def verify_csrf(
    request: Request,
    auth: tuple[User, AuthSession] | None = Depends(optional_auth),
) -> None:
    origin = request.headers.get("origin")
    allowed = set(settings.cors_origins) | {settings.frontend_url}
    if origin and origin.rstrip("/") not in allowed:
        raise HTTPException(status_code=403, detail="Origem da solicitação não permitida.")
    if not origin and settings.environment != "development":
        raise HTTPException(status_code=403, detail="A origem da solicitação é obrigatória.")
    if auth and not secrets.compare_digest(request.headers.get("x-csrf-token", ""), auth[1].csrf_token):
        raise HTTPException(status_code=403, detail="Token CSRF inválido ou ausente.")


def product_payload(product: Product) -> dict[str, Any]:
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category.name,
        "category_key": product.category_id,
        "image_path": product.image_path,
        "price_cents": product.price_cents,
        "stock": product.stock,
        "weight_grams": product.weight_grams,
        "dimensions": product.dimensions,
        "description": product.description,
        "is_active": product.is_active,
    }


def aggregate_items(rows: list[Any]) -> list[tuple[str, int]]:
    totals: dict[str, int] = {}
    for row in rows:
        product_id = str(row.product_id)
        totals[product_id] = totals.get(product_id, 0) + int(row.quantity)
    return sorted(totals.items())


def load_order_lines(session: Session, items: list[tuple[str, int]], *, lock: bool = False) -> tuple[list[tuple[Product, int]], int]:
    product_ids = [product_id for product_id, _ in items]
    query = select(Product).options(joinedload(Product.category)).where(Product.id.in_(product_ids)).order_by(Product.id)
    if lock:
        query = query.with_for_update()
    products = {product.id: product for product in session.scalars(query).all()}
    if len(products) != len(product_ids):
        raise HTTPException(status_code=404, detail="Um ou mais produtos não foram encontrados.")
    lines: list[tuple[Product, int]] = []
    subtotal = 0
    for product_id, quantity in items:
        product = products[product_id]
        try:
            priced = price_line(product, quantity)
        except ProductNotPurchasable as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        lines.append((product, quantity))
        subtotal += priced.line_total_cents
    return lines, subtotal


@router.get("/health")
def health(
    payment_provider: PaymentProvider = Depends(get_payment_provider),
    shipping_provider: ShippingProvider = Depends(get_shipping_provider),
) -> dict[str, Any]:
    return {
        "status": "ok",
        "google_login_configured": bool(settings.google_client_id and settings.google_client_secret),
        "payments_configured": payment_provider.is_configured(),
        "shipping_configured": shipping_provider.is_configured() or (settings.shipping_simulation and settings.environment == "development"),
    }


@router.get("/categories")
def categories(session: Session = Depends(get_session)) -> list[dict[str, str]]:
    rows = get_catalog(session)
    values = {row.category_id: row.category.name for row in rows}
    return [{"id": key, "name": values[key]} for key in sorted(values, key=lambda item: values[item])]


@router.get("/products")
def products(category: str | None = Query(default=None), search: str | None = Query(default=None), session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    return [product_payload(row) for row in get_catalog(session, category, search)]


@router.get("/products/{product_id}")
def product_detail(product_id: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    row = session.scalar(select(Product).options(joinedload(Product.category)).where(Product.id == product_id, Product.is_active.is_(True)))
    if row is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product_payload(row)


@router.get("/auth/google")
async def google_login(request: Request):
    if google_oauth is None:
        raise HTTPException(status_code=503, detail="Login Google ainda não está configurado.")
    verifier = secrets.token_urlsafe(48)
    challenge = hashlib.sha256(verifier.encode()).digest()
    import base64
    challenge_text = base64.urlsafe_b64encode(challenge).decode().rstrip("=")
    request.session["google_pkce_verifier"] = verifier
    return await google_oauth.google.authorize_redirect(
        request,
        settings.google_redirect_uri,
        code_challenge=challenge_text,
        code_challenge_method="S256",
    )


@router.get("/auth/google/callback")
async def google_callback(request: Request, session: Session = Depends(get_session)):
    if google_oauth is None:
        raise HTTPException(status_code=503, detail="Login Google ainda não está configurado.")
    verifier = request.session.pop("google_pkce_verifier", None)
    if not verifier:
        raise HTTPException(status_code=400, detail="Fluxo Google expirado. Tente entrar novamente.")
    try:
        token = await google_oauth.google.authorize_access_token(request, code_verifier=verifier)
        profile = token.get("userinfo") or await google_oauth.google.userinfo(token=token)
    except OAuthError as exc:
        raise HTTPException(status_code=401, detail="Não foi possível validar a identidade Google.") from exc
    if not profile or not profile.get("sub") or not profile.get("email") or profile.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="A identidade retornada pelo Google não foi confirmada.")

    users = SqlUserRepository(session)
    email = str(profile["email"]).strip().casefold()
    user = users.find_by_google_sub(str(profile["sub"]))
    if user is None:
        user = users.find_by_email(email)
        if user is not None and user.google_sub != str(profile["sub"]):
            raise HTTPException(status_code=409, detail="Este e-mail já está vinculado a outra identidade.")
    if user is None:
        user = User(google_sub=str(profile["sub"]), email=email, name=profile.get("name"), role="customer")
        users.save(user)
    user.name = profile.get("name") or user.name
    user.email = email
    if email in settings.admin_emails:
        user.role = "admin"
    session_token = secrets.token_urlsafe(40)
    csrf_token = secrets.token_urlsafe(32)
    auth_session = AuthSession(
        session_hash=hashlib.sha256(session_token.encode()).hexdigest(),
        csrf_token=csrf_token,
        user_id=user.id,
        expires_at=utc_now() + timedelta(days=30),
    )
    # The browser receives a random opaque cookie. Only its digest is persisted.
    session.add(auth_session)
    session.commit()
    request.session.clear()
    response = RedirectResponse(f"{settings.frontend_url}/?login=complete", status_code=303)
    response.set_cookie(
        "lunie_session", session_token, httponly=True, secure=settings.cookie_secure,
        samesite="lax" if settings.environment == "development" else "none", max_age=60 * 60 * 24 * 30, path="/",
    )
    return response


@router.get("/auth/me")
def auth_me(auth: tuple[User, AuthSession] | None = Depends(optional_auth)) -> dict[str, Any]:
    if auth is None:
        return {"user": None, "csrf_token": None}
    user, auth_session = auth
    return {
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role},
        "csrf_token": auth_session.csrf_token,
    }


@router.post("/auth/logout")
def logout(
    response: Response,
    auth: tuple[User, AuthSession] = Depends(require_auth),
    _: None = Depends(verify_csrf),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    auth[1].revoked_at = utc_now()
    session.commit()
    response.delete_cookie("lunie_session", path="/")
    return {"ok": True}


@router.get("/account/orders")
def account_orders(auth: tuple[User, AuthSession] = Depends(require_auth), session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    rows = session.scalars(select(Order).where(Order.user_id == auth[0].id).order_by(Order.created_at.desc())).all()
    return [{"id": row.id, "status": row.status, "total_cents": row.total_cents, "created_at": row.created_at.isoformat()} for row in rows]


@router.get("/account/addresses")
def account_addresses(auth: tuple[User, AuthSession] = Depends(require_auth), session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    rows = session.scalars(select(Address).where(Address.user_id == auth[0].id).order_by(Address.is_default.desc(), Address.id)).all()
    return [{"id": row.id, "is_default": row.is_default, **decrypt_json(row.encrypted_payload)} for row in rows]


@router.post("/account/addresses", status_code=201)
def create_address(
    address: AddressInput,
    auth: tuple[User, AuthSession] = Depends(require_auth),
    _: None = Depends(verify_csrf),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    row = Address(user_id=auth[0].id, encrypted_payload=encrypt_json(address.model_dump()), is_default=False)
    session.add(row)
    session.commit()
    return {"id": row.id, "is_default": row.is_default, **address.model_dump()}


@router.get("/admin/products")
def admin_products(auth: tuple[User, AuthSession] = Depends(require_admin), session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    rows = SqlProductRepository(session).list_all()
    return [product_payload(row) for row in rows]


@router.patch("/admin/products/{product_id}")
def update_product(
    product_id: str,
    changes: ProductPatch,
    auth: tuple[User, AuthSession] = Depends(require_admin),
    _: None = Depends(verify_csrf),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    product = session.scalar(select(Product).options(joinedload(Product.category)).where(Product.id == product_id))
    if product is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    for key, value in changes.model_dump(exclude_unset=True).items():
        if key == "dimensions" and value is not None:
            value = value
        setattr(product, key, value)
    session.commit()
    session.refresh(product)
    return product_payload(product)


@router.post("/shipping/quotes")
async def shipping_quotes(
    payload: ShippingQuoteInput,
    _: None = Depends(verify_csrf),
    shipping_provider: ShippingProvider = Depends(get_shipping_provider),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    items = aggregate_items(payload.items)
    lines, _ = load_order_lines(session, items)
    try:
        results = await shipping_provider.quote(lines, payload.to_postal_code)
    except ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not results:
        return {"quotes": []}
    digest = cart_fingerprint(items)
    output = []
    expiry = utc_now() + timedelta(minutes=10)
    for result in results:
        quote = ShippingQuote(
            id=str(uuid4()),
            cart_hash=digest,
            destination_postal_code_encrypted=encrypt_value(payload.to_postal_code),
            service_id=result["service_id"], carrier=result["carrier"], service_name=result["service"],
            price_cents=result["price_cents"], delivery_days=result["delivery_days"],
            is_simulation=result["simulation"], raw_data=result["raw"], expires_at=expiry,
        )
        session.add(quote)
        output.append({
            "id": quote.id, "carrier": quote.carrier, "service": quote.service_name,
            "price_cents": quote.price_cents, "delivery_days": quote.delivery_days,
            "simulation": quote.is_simulation,
        })
    session.commit()
    return {"quotes": output}


@router.post("/checkout", status_code=201)
async def checkout(
    payload: CheckoutInput,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    auth: tuple[User, AuthSession] | None = Depends(optional_auth),
    _: None = Depends(verify_csrf),
    payment_provider: PaymentProvider = Depends(get_payment_provider),
    shipping_provider: ShippingProvider = Depends(get_shipping_provider),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    if not idempotency_key or len(idempotency_key) < 16 or len(idempotency_key) > 80:
        raise HTTPException(status_code=400, detail="Chave de idempotência ausente ou inválida.")
    previous = session.scalar(select(Order).options(joinedload(Order.payment)).where(Order.idempotency_key == idempotency_key))
    if previous:
        if previous.payment and previous.payment.checkout_url:
            return {"order_id": previous.id, "checkout_url": previous.payment.checkout_url, "reused": True}
        raise HTTPException(status_code=409, detail="Este checkout já foi processado. Recarregue a sacola antes de tentar novamente.")
    if not payment_provider.is_configured():
        raise HTTPException(status_code=503, detail="Checkout Mercado Pago ainda não está configurado.")

    items = aggregate_items(payload.items)
    lines, subtotal = load_order_lines(session, items)
    quote = session.get(ShippingQuote, payload.shipping_quote_id)
    if quote is None or quote.expires_at <= utc_now():
        raise HTTPException(status_code=409, detail="A cotação de frete expirou. Calcule o frete novamente.")
    if quote.cart_hash != cart_fingerprint(items):
        raise HTTPException(status_code=409, detail="O carrinho mudou. Calcule o frete novamente.")
    destination = decrypt_value(quote.destination_postal_code_encrypted)
    address = payload.address.model_dump()
    if destination != address["postal_code"]:
        raise HTTPException(status_code=409, detail="O CEP do endereço mudou. Calcule o frete novamente.")

    try:
        fresh_quotes = await shipping_provider.quote(lines, address["postal_code"])
    except ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    fresh = next((row for row in fresh_quotes if row["service_id"] == quote.service_id), None)
    if fresh is None:
        raise HTTPException(status_code=409, detail="A modalidade escolhida não está mais disponível. Calcule o frete novamente.")
    if fresh["price_cents"] != quote.price_cents:
        quote.price_cents = fresh["price_cents"]
        quote.delivery_days = fresh["delivery_days"]
        quote.raw_data = fresh["raw"]
        quote.expires_at = utc_now() + timedelta(minutes=10)
        session.commit()
        raise HTTPException(status_code=409, detail="O valor do frete foi atualizado. Confira a nova cotação e selecione novamente.")

    try:
        lines, subtotal = load_order_lines(session, items, lock=True)
    except HTTPException:
        session.rollback()
        raise
    for product, quantity in lines:
        product.stock = int(product.stock or 0) - quantity
    address_row = None
    if auth:
        address_row = Address(user_id=auth[0].id, encrypted_payload=encrypt_json(address), is_default=False)
        session.add(address_row)
        session.flush()
    order = Order(
        id=str(uuid4()), idempotency_key=idempotency_key, user_id=auth[0].id if auth else None,
        address_id=address_row.id if address_row else None, email=payload.email,
        address_snapshot_encrypted=encrypt_json(address), status="pending", stock_reserved=True,
        subtotal_cents=subtotal, shipping_cents=quote.price_cents,
        total_cents=subtotal + quote.price_cents, shipping_quote_id=quote.id,
    )
    order.items = [OrderItem(
        product_id=product.id, product_name=product.name, unit_price_cents=int(product.price_cents or 0),
        quantity=quantity, line_total_cents=int(product.price_cents or 0) * quantity,
    ) for product, quantity in lines]
    order.payment = Payment(amount_cents=subtotal + quote.price_cents, status="pending")
    order.shipment = Shipment(
        service_id=quote.service_id, carrier=quote.carrier, service_name=quote.service_name,
        price_cents=quote.price_cents, delivery_days=quote.delivery_days, status="pending",
    )
    session.add(order)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        previous = session.scalar(select(Order).options(joinedload(Order.payment)).where(Order.idempotency_key == idempotency_key))
        if previous and previous.payment and previous.payment.checkout_url:
            return {"order_id": previous.id, "checkout_url": previous.payment.checkout_url, "reused": True}
        raise HTTPException(status_code=409, detail="Este checkout já está em processamento.")

    try:
        preference = await payment_provider.create_checkout(order, order.items)
    except ProviderUnavailable as exc:
        order.status = "rejected"
        order.stock_reserved = False
        for product, quantity in lines:
            product.stock = int(product.stock or 0) + quantity
        order.payment.status = "rejected"
        session.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    checkout_url = preference.get("init_point")
    preference_id = preference.get("id")
    if not checkout_url or not preference_id:
        order.status = "rejected"
        order.stock_reserved = False
        for product, quantity in lines:
            product.stock = int(product.stock or 0) + quantity
        order.payment.status = "rejected"
        session.commit()
        raise HTTPException(status_code=502, detail="O Mercado Pago não retornou um checkout válido.")
    order.payment.preference_id = str(preference_id)
    order.payment.checkout_url = str(checkout_url)
    session.commit()
    return {"order_id": order.id, "checkout_url": checkout_url, "reused": False}


@router.post("/webhooks/mercadopago")
async def mercadopago_webhook(
    request: Request,
    signature: str | None = Header(default=None, alias="x-signature"),
    request_id: str | None = Header(default=None, alias="x-request-id"),
    payment_provider: PaymentProvider = Depends(get_payment_provider),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    try:
        body = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Evento de pagamento inválido.") from exc
    data_id = str((body.get("data") or {}).get("id") or request.query_params.get("data.id") or "")
    if not payment_provider.verify_webhook(signature or "", request_id or "", data_id):
        raise HTTPException(status_code=401, detail="Assinatura de webhook inválida.")
    try:
        remote = await payment_provider.get_payment(data_id)
    except ProviderUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    order_id = str(remote.get("external_reference") or "")
    order = session.execute(select(Order).options(joinedload(Order.payment), joinedload(Order.items)).where(Order.id == order_id)).unique().scalar_one_or_none()
    if order is None or order.payment is None:
        raise HTTPException(status_code=404, detail="Pedido associado ao pagamento não foi encontrado.")
    paid_cents = int((Decimal(str(remote.get("transaction_amount", 0))) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if paid_cents != order.total_cents:
        raise HTTPException(status_code=409, detail="O valor consultado no Mercado Pago não corresponde ao pedido.")
    status_map = {
        "approved": "approved", "rejected": "rejected", "cancelled": "cancelled",
        "refunded": "refunded", "charged_back": "refunded", "in_process": "pending",
        "pending": "pending", "authorized": "pending",
    }
    new_status = status_map.get(str(remote.get("status", "pending")), "pending")
    old_status = order.status
    if old_status in {"approved", "refunded"} and new_status in {"pending", "rejected", "cancelled"}:
        return {"ok": True}
    if old_status in {"rejected", "cancelled"} and new_status == "pending":
        return {"ok": True}
    order.payment.external_id = data_id
    order.payment.status = new_status
    order.payment.last_webhook_data = {"status": remote.get("status"), "status_detail": remote.get("status_detail")}
    if new_status in {"rejected", "cancelled"} and order.stock_reserved:
        for item in order.items:
            product = session.get(Product, item.product_id)
            if product:
                product.stock = int(product.stock or 0) + item.quantity
        order.stock_reserved = False
    elif new_status == "approved" and not order.stock_reserved:
        can_reserve = True
        products_by_id = {item.product_id: session.get(Product, item.product_id) for item in order.items}
        for item in order.items:
            product = products_by_id[item.product_id]
            if product is None or product.stock is None or product.stock < item.quantity:
                can_reserve = False
        if can_reserve:
            for item in order.items:
                products_by_id[item.product_id].stock -= item.quantity
            order.stock_reserved = True
        else:
            order.inventory_issue = "Pagamento aprovado após liberação do estoque; revisão administrativa necessária."
    # A browser return URL never changes the order state; only this verified notification does.
    if new_status != "pending" or old_status == "pending":
        order.status = new_status
    session.commit()
    return {"ok": True}


@router.post("/webhooks/melhor-envio")
async def melhor_envio_webhook(
    request: Request,
    shipping_provider: ShippingProvider = Depends(get_shipping_provider),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    raw_body = await request.body()
    if not shipping_provider.verify_webhook(request.headers.get("x-me-signature", ""), raw_body):
        raise HTTPException(status_code=401, detail="Assinatura de webhook Melhor Envio inválida.")
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Evento inválido.") from exc
    data = payload.get("data") or {}
    provider_order_id = str(data.get("id") or "")
    shipment = session.scalar(select(Shipment).where(Shipment.provider_order_id == provider_order_id))
    if shipment is None:
        raise HTTPException(status_code=404, detail="Etiqueta não encontrada.")
    shipment.status = str(data.get("status") or payload.get("event", "pending")).removeprefix("order.")
    shipment.tracking_code = data.get("tracking") or shipment.tracking_code
    shipment.tracking_url = data.get("tracking_url") or shipment.tracking_url
    shipment.raw_data = {"event": payload.get("event"), "status": data.get("status")}
    session.commit()
    return {"ok": True}


@router.get("/admin/config")
def admin_config(
    auth: tuple[User, AuthSession] = Depends(require_admin),
    payment_provider: PaymentProvider = Depends(get_payment_provider),
    shipping_provider: ShippingProvider = Depends(get_shipping_provider),
) -> dict[str, Any]:
    return {
        "environment": settings.environment,
        "google_login_configured": bool(settings.google_client_id and settings.google_client_secret),
        "payments_configured": payment_provider.is_configured(),
        "payment_webhook_configured": bool(settings.mercadopago_webhook_secret and settings.mercadopago_webhook_url),
        "shipping_configured": shipping_provider.is_configured(),
        "shipping_sandbox": settings.melhor_envio_sandbox,
        "shipping_simulation": settings.shipping_simulation and settings.environment == "development",
        "pii_encryption_key_configured": bool(settings.pii_encryption_key),
    }


@router.get("/admin/orders")
def admin_orders(auth: tuple[User, AuthSession] = Depends(require_admin), session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    rows = session.scalars(select(Order).options(joinedload(Order.shipment), joinedload(Order.payment)).order_by(Order.created_at.desc()).limit(200)).all()
    return [{
        "id": row.id, "email": row.email, "status": row.status,
        "payment_status": row.payment.status if row.payment else None,
        "shipment_status": row.shipment.status if row.shipment else None,
        "carrier": row.shipment.carrier if row.shipment else None,
        "service": row.shipment.service_name if row.shipment else None,
        "tracking_code": row.shipment.tracking_code if row.shipment else None,
        "tracking_url": row.shipment.tracking_url if row.shipment else None,
        "label_url": row.shipment.label_url if row.shipment else None,
        "inventory_issue": row.inventory_issue,
        "total_cents": row.total_cents, "created_at": row.created_at.isoformat(),
    } for row in rows]


@router.post("/admin/orders/{order_id}/shipment/label")
async def create_shipment_label(
    order_id: str,
    auth: tuple[User, AuthSession] = Depends(require_admin),
    _: None = Depends(verify_csrf),
    shipping_provider: ShippingProvider = Depends(get_shipping_provider),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    order = session.scalar(select(Order).options(joinedload(Order.payment), joinedload(Order.shipment), joinedload(Order.items), joinedload(Order.shipping_quote)).where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    if not order.payment or order.payment.status != "approved":
        raise HTTPException(status_code=409, detail="A etiqueta só pode ser comprada após a confirmação do pagamento.")
    if order.shipment and order.shipment.provider_order_id:
        return {"shipment_id": order.shipment.id, "provider_order_id": order.shipment.provider_order_id, "tracking_url": order.shipment.tracking_url, "label_url": order.shipment.label_url, "reused": True}
    if order.shipping_quote.is_simulation:
        raise HTTPException(status_code=409, detail="Uma cotação simulada não permite criar etiqueta.")
    try:
        result = await shipping_provider.create_label(order, session)
    except ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    order.shipment.provider_order_id = result["id"]
    order.shipment.tracking_code = result.get("tracking")
    order.shipment.tracking_url = result.get("tracking_url")
    order.shipment.label_url = _find_label_url(result.get("print"))
    order.shipment.status = "released"
    order.shipment.raw_data = {"provider_order_id": result["id"]}
    session.commit()
    return {"shipment_id": order.shipment.id, "provider_order_id": order.shipment.provider_order_id, "tracking_url": order.shipment.tracking_url, "label_url": order.shipment.label_url, "reused": False}


def _find_label_url(value: Any) -> str | None:
    if isinstance(value, str) and value.startswith("https://"):
        return value
    if isinstance(value, dict):
        for child in value.values():
            found = _find_label_url(child)
            if found:
                return found
    if isinstance(value, list):
        for child in value:
            found = _find_label_url(child)
            if found:
                return found
    return None

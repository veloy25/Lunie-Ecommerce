from __future__ import annotations

import base64
import hashlib
import hmac
import json
from decimal import Decimal
from typing import Any

import httpx

from app.core.settings import settings
from app.infrastructure.adapters.mercadopago import ProviderUnavailable
from app.infrastructure.pii import decrypt_json


class MelhorEnvioAdapter:
    def is_configured(self) -> bool:
        return bool(settings.melhor_envio_token and settings.melhor_envio_from_postal_code)

    @property
    def base_url(self) -> str:
        host = "https://sandbox.melhorenvio.com.br" if settings.melhor_envio_sandbox else "https://melhorenvio.com.br"
        return f"{host}/api/v2/me"

    def _headers(self) -> dict[str, str]:
        if not settings.melhor_envio_token:
            raise ProviderUnavailable("Melhor Envio ainda não está configurado.")
        return {
            "Authorization": f"Bearer {settings.melhor_envio_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": settings.melhor_envio_user_agent,
        }

    async def quote(self, items: list[tuple[Any, int]], destination_postal_code: str) -> list[dict[str, Any]]:
        if settings.shipping_simulation and settings.environment == "development" and not self.is_configured():
            return [
                {"service_id": "dev-pickup", "carrier": "Simulação local", "service": "Retirada simulada", "price_cents": 0, "delivery_days": None, "simulation": True, "raw": {}},
                {"service_id": "dev-postal", "carrier": "Simulação local", "service": "Entrega simulada", "price_cents": 1590, "delivery_days": 5, "simulation": True, "raw": {}},
            ]
        if not self.is_configured():
            raise ProviderUnavailable("Frete Melhor Envio indisponível: faltam token e CEP de origem.")

        product_rows = []
        for product, quantity in items:
            dimensions = getattr(product, "dimensions", None) or {}
            weight = getattr(product, "weight_grams", None)
            price = getattr(product, "price_cents", None)
            if not dimensions or weight is None or price is None:
                raise ProviderUnavailable("Cadastre peso, dimensões e preço para cotar este produto.")
            product_rows.append({
                "id": getattr(product, "id"),
                "width": dimensions["width_cm"],
                "height": dimensions["height_cm"],
                "length": dimensions["length_cm"],
                "weight": float(Decimal(weight) / Decimal(1000)),
                "insurance_value": float(Decimal(price) / Decimal(100)),
                "quantity": quantity,
            })
        payload = {
            "from": {"postal_code": settings.melhor_envio_from_postal_code},
            "to": {"postal_code": destination_postal_code},
            "products": product_rows,
            "options": {"receipt": False, "own_hand": False},
        }
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(f"{self.base_url}/shipment/calculate", headers=self._headers(), json=payload)
        if response.is_error:
            raise ProviderUnavailable("O Melhor Envio não retornou cotações para estes dados.")
        result = response.json()
        quotes = []
        for row in result if isinstance(result, list) else []:
            if row.get("error") or row.get("price") is None:
                continue
            price_value = row.get("custom_price") or row.get("price")
            try:
                price_cents = int((Decimal(str(price_value)) * 100).quantize(Decimal("1")))
            except Exception:
                continue
            company = row.get("company") or {}
            quotes.append({
                "service_id": str(row.get("id", "")),
                "carrier": str(company.get("name") or "Transportadora"),
                "service": str(row.get("name") or "Modalidade"),
                "price_cents": price_cents,
                "delivery_days": _to_int(row.get("custom_delivery_time") or row.get("delivery_time")),
                "simulation": False,
                "raw": row,
            })
        return quotes

    async def create_label(self, order: Any, session: Any) -> dict[str, Any]:
        if not self.is_configured():
            raise ProviderUnavailable("Melhor Envio ainda não está configurado.")
        try:
            sender = json.loads(settings.melhor_envio_sender_json)
        except json.JSONDecodeError as exc:
            raise ProviderUnavailable("Configure os dados do remetente antes de comprar etiquetas.") from exc
        required_sender = {"name", "email", "phone", "document", "address", "number", "district", "city", "postal_code", "state_abbr"}
        if not required_sender.issubset(sender):
            raise ProviderUnavailable("Dados do remetente incompletos para gerar a etiqueta.")
        if not settings.melhor_envio_invoice_key:
            raise ProviderUnavailable("Configure a chave da nota fiscal antes de comprar uma etiqueta comercial.")
        quote = order.shipping_quote
        package_rows = (quote.raw_data or {}).get("packages") or []
        if not package_rows:
            raise ProviderUnavailable("O Melhor Envio não retornou os volumes usados na cotação.")
        address = decrypt_json(order.address_snapshot_encrypted)
        products = [{
            "name": item.product_name,
            "quantity": str(item.quantity),
            "unitary_value": str(Decimal(item.unit_price_cents) / Decimal(100)),
        } for item in order.items]
        volumes = []
        for package in package_rows:
            dimensions = package.get("dimensions") or {}
            volumes.append({
                "height": dimensions.get("height"),
                "width": dimensions.get("width"),
                "length": dimensions.get("length"),
                "weight": package.get("weight"),
            })
        body = {
            "service": int(quote.service_id) if quote.service_id.isdigit() else quote.service_id,
            "from": sender,
            "to": {
                "name": address["name"], "email": order.email,
                "phone": address["phone"], "document": address["document"],
                "address": address["street"], "number": address["number"],
                "complement": address.get("complement") or "", "district": address["district"],
                "city": address["city"], "postal_code": address["postal_code"], "state_abbr": address["state"], "country_id": "BR",
            },
            "products": products,
            "volumes": volumes,
            "options": {
                "platform": "Luniê",
                "insurance_value": float(Decimal(order.subtotal_cents) / Decimal(100)),
                "invoice": {"key": settings.melhor_envio_invoice_key},
                "tags": [{"tag": order.id, "url": f"{settings.frontend_url}/?order={order.id}"}],
            },
        }
        async with httpx.AsyncClient(timeout=20) as client:
            created = await client.post(f"{self.base_url}/cart", headers=self._headers(), json=body)
            if created.is_error:
                raise ProviderUnavailable("O Melhor Envio recusou a criação da etiqueta.")
            label = created.json()
            provider_order_id = str(label.get("id", ""))
            if not provider_order_id:
                raise ProviderUnavailable("O Melhor Envio não retornou o identificador da etiqueta.")
            purchased = await client.post(f"{self.base_url}/shipment/checkout", headers=self._headers(), json={"orders": [provider_order_id]})
            if purchased.is_error:
                raise ProviderUnavailable("A etiqueta foi criada no carrinho, mas o Melhor Envio não confirmou a compra.")
            await client.post(f"{self.base_url}/shipment/generate", headers=self._headers(), json={"orders": [provider_order_id]})
            printed = await client.post(f"{self.base_url}/shipment/print", headers=self._headers(), json={"orders": [provider_order_id]})
            print_data = printed.json() if not printed.is_error else {}
        return {"id": provider_order_id, "tracking": label.get("tracking"), "tracking_url": label.get("tracking_url"), "print": print_data, "raw": label}

    @staticmethod
    def verify_webhook(signature: str, raw_body: bytes) -> bool:
        secret = settings.melhor_envio_webhook_secret
        if not secret or not signature:
            return False
        digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).digest()
        expected = base64.b64encode(digest).decode()
        return hmac.compare_digest(expected, signature)


def _to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

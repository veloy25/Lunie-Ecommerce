from __future__ import annotations

import hashlib
import hmac
from decimal import Decimal

import httpx

from app.core.settings import settings
from app.infrastructure.pii import decrypt_json


class ProviderUnavailable(RuntimeError):
    pass


class MercadoPagoAdapter:
    preference_url = "https://api.mercadopago.com/checkout/preferences"

    def is_configured(self) -> bool:
        return bool(settings.mercadopago_access_token)

    async def create_checkout(self, order: object, items: list[object]) -> dict:
        if not self.is_configured():
            raise ProviderUnavailable("Mercado Pago ainda não está configurado.")
        address = decrypt_json(getattr(order, "address_snapshot_encrypted"))
        payload = {
            "items": [
                {
                    "id": getattr(item, "product_id"),
                    "title": getattr(item, "product_name"),
                    "quantity": getattr(item, "quantity"),
                    "currency_id": "BRL",
                    "unit_price": float(Decimal(getattr(item, "unit_price_cents")) / Decimal(100)),
                }
                for item in items
            ],
            "payer": {"email": getattr(order, "email")},
            "shipments": {
                "cost": float(Decimal(getattr(order, "shipping_cents")) / Decimal(100)),
                "free_shipping": False,
                "receiver_address": {
                    "zip_code": address["postal_code"],
                    "street_name": address["street"],
                    "city_name": address["city"],
                    "state_name": address["state"],
                    "street_number": address["number"],
                    "country_name": "Brasil",
                },
            },
            "external_reference": getattr(order, "id"),
            "back_urls": {
                "success": f"{settings.frontend_url}/?payment=returned",
                "pending": f"{settings.frontend_url}/?payment=pending",
                "failure": f"{settings.frontend_url}/?payment=failed",
            },
            "auto_return": "approved",
            "statement_descriptor": "LUNIE",
        }
        if settings.mercadopago_webhook_url:
            payload["notification_url"] = settings.mercadopago_webhook_url
        headers = {
            "Authorization": f"Bearer {settings.mercadopago_access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": hashlib.sha256(f"lunie:{getattr(order, 'id')}".encode()).hexdigest(),
        }
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(self.preference_url, headers=headers, json=payload)
        if response.is_error:
            raise ProviderUnavailable("Mercado Pago não aceitou a preferência de pagamento.")
        return response.json()

    def verify_webhook(self, signature: str, request_id: str, data_id: str) -> bool:
        if not settings.mercadopago_webhook_secret or not signature or not request_id or not data_id:
            return False
        fields = dict(part.split("=", 1) for part in signature.split(",") if "=" in part)
        timestamp = fields.get("ts")
        received = fields.get("v1")
        if not timestamp or not received:
            return False
        manifest = f"id:{data_id.lower()};request-id:{request_id};ts:{timestamp};".encode()
        expected = hmac.new(settings.mercadopago_webhook_secret.encode(), manifest, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, received.lower())

    async def get_payment(self, payment_id: str) -> dict:
        if not self.is_configured():
            raise ProviderUnavailable("Mercado Pago ainda não está configurado.")
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"https://api.mercadopago.com/v1/payments/{payment_id}",
                headers={"Authorization": f"Bearer {settings.mercadopago_access_token}"},
            )
        if response.is_error:
            raise ProviderUnavailable("Não foi possível consultar o pagamento no Mercado Pago.")
        return response.json()

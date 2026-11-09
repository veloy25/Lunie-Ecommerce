from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("APP_ENV", "development").lower()
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./lunie.db")
    session_secret: str = os.getenv("SESSION_SECRET", "local-development-key-change-before-deploy")
    pii_encryption_key: str = os.getenv("PII_ENCRYPTION_KEY", "")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    cors_origins: tuple[str, ...] = tuple(
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    )
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    google_redirect_uri: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    admin_emails: tuple[str, ...] = tuple(
        email.strip().casefold()
        for email in os.getenv("ADMIN_EMAILS", "").split(",")
        if email.strip()
    )
    mercadopago_access_token: str = os.getenv("MERCADOPAGO_ACCESS_TOKEN", "")
    mercadopago_webhook_secret: str = os.getenv("MERCADOPAGO_WEBHOOK_SECRET", "")
    mercadopago_webhook_url: str = os.getenv("MERCADOPAGO_WEBHOOK_URL", "")
    melhor_envio_token: str = os.getenv("MELHORENVIO_TOKEN", "")
    melhor_envio_webhook_secret: str = os.getenv("MELHORENVIO_WEBHOOK_SECRET", "")
    melhor_envio_from_postal_code: str = os.getenv("MELHORENVIO_FROM_POSTAL_CODE", "")
    melhor_envio_sandbox: bool = os.getenv("MELHORENVIO_SANDBOX", "true").lower() in {"1", "true", "yes"}
    melhor_envio_user_agent: str = os.getenv("MELHORENVIO_USER_AGENT", "Luniê (suporte técnico a configurar)")
    shipping_simulation: bool = os.getenv("SHIPPING_SIMULATION", "false").lower() in {"1", "true", "yes"}
    catalog_path: str = os.getenv("CATALOG_PATH", "catalog/products.json")
    melhor_envio_sender_json: str = os.getenv("MELHORENVIO_SENDER_JSON", "")
    melhor_envio_invoice_key: str = os.getenv("MELHORENVIO_INVOICE_KEY", "")

    @property
    def cookie_secure(self) -> bool:
        return self.environment in {"homolog", "production", "prod"}

    @property
    def is_production(self) -> bool:
        return self.environment in {"production", "prod"}


settings = Settings()

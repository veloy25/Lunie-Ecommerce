from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.settings import settings


def _fernet() -> Fernet:
    key = settings.pii_encryption_key
    if not key:
        if settings.environment != "development":
            raise RuntimeError("PII_ENCRYPTION_KEY deve ser configurada em homologação e produção.")
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.session_secret.encode()).digest()).decode()
    return Fernet(key.encode())


def encrypt_value(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_value(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Dados pessoais não puderam ser descriptografados; confira PII_ENCRYPTION_KEY.") from exc


def encrypt_json(value: dict[str, Any]) -> str:
    return encrypt_value(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def decrypt_json(value: str) -> dict[str, Any]:
    parsed = json.loads(decrypt_value(value))
    if not isinstance(parsed, dict):
        raise ValueError("Conteúdo pessoal criptografado inválido.")
    return parsed

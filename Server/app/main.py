from __future__ import annotations

from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.application.catalog import seed_catalog
from app.core.settings import settings
from app.infrastructure.database import Base, SessionLocal, engine
from app.infrastructure import models as _models  # noqa: F401
from app.infrastructure.pii import _fernet
from app.presentation.routes import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.environment != "development":
        if settings.session_secret == "local-development-key-change-before-deploy":
            raise RuntimeError("SESSION_SECRET deve ser configurada fora do desenvolvimento local.")
        _fernet()  # Validate the dedicated encryption key before accepting customer data.
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_catalog(session)
    yield


app = FastAPI(title="Luniê Store API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie="lunie_oauth",
    max_age=600,
    same_site="lax",
    https_only=settings.cookie_secure,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(settings.cors_origins) | {settings.frontend_url}),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Idempotency-Key", "X-Request-Id"],
)
app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "Luniê Store API", "docs": "/docs"}

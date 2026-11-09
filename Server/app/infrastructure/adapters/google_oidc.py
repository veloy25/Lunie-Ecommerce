from authlib.integrations.starlette_client import OAuth

from app.core.settings import settings


def create_google_oauth() -> OAuth | None:
    if not settings.google_client_id or not settings.google_client_secret:
        return None
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth

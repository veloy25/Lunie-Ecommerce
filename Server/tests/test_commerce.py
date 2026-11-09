from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.application.catalog import seed_catalog
from app.domain.commerce import ProductNotPurchasable, cart_fingerprint, price_line
from app.infrastructure.database import Base
from app.infrastructure.models import Product
from app.infrastructure.pii import decrypt_json, encrypt_json
from app.presentation.schemas import AddressInput, CheckoutInput


@pytest.fixture
def database() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session
    engine.dispose()


def test_price_line_rejects_missing_price_and_stock() -> None:
    product = SimpleNamespace(id="lavanda", name="Sabonete Lavanda", is_active=True, price_cents=None, stock=None)
    with pytest.raises(ProductNotPurchasable):
        price_line(product, 1)


def test_price_line_uses_integer_cents_and_checks_quantity() -> None:
    product = SimpleNamespace(id="lavanda", name="Sabonete Lavanda", is_active=True, price_cents=2490, stock=3)
    line = price_line(product, 2)
    assert line.line_total_cents == 4980
    with pytest.raises(ProductNotPurchasable):
        price_line(product, 4)


def test_cart_fingerprint_is_order_independent() -> None:
    assert cart_fingerprint([("b", 1), ("a", 2)]) == cart_fingerprint([("a", 2), ("b", 1)])
    assert cart_fingerprint([("a", 2)]) != cart_fingerprint([("a", 1)])


def test_catalog_seeds_real_products_without_guessing_price_or_stock(database: Session) -> None:
    project_root = Path(__file__).resolve().parents[2]
    created = seed_catalog(database)
    rows = list(database.scalars(select(Product)).all())
    assert created == len(rows) == 34
    assert all(row.price_cents is None and row.stock is None for row in rows)
    assert all((project_root / "Client/client/public" / row.image_path.lstrip("/")).is_file() for row in rows)


def test_personal_data_is_encrypted_at_rest() -> None:
    original = {"postal_code": "01310100", "document": "52998224725"}
    encrypted = encrypt_json(original)
    assert "52998224725" not in encrypted
    assert decrypt_json(encrypted) == original


def test_checkout_requires_the_same_email_for_address_and_order() -> None:
    address = AddressInput(
        name="Ana Pessoa", email="ana@example.com", phone="11987654321", document="529.982.247-25",
        postal_code="01310-100", street="Rua Um", number="10", district="Centro", city="São Paulo", state="sp",
    )
    assert address.postal_code == "01310100"
    assert address.document == "52998224725"
    with pytest.raises(ValueError):
        CheckoutInput(items=[{"product_id": "produto", "quantity": 1}], email="outra@example.com", address=address, shipping_quote_id="0" * 36)

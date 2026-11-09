from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    products: Mapped[list[Product]] = relationship(back_populates="category")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    google_sub: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="customer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    addresses: Mapped[list[Address]] = relationship(back_populates="user")
    orders: Mapped[list[Order]] = relationship(back_populates="user")


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    encrypted_payload: Mapped[str] = mapped_column(Text, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    user: Mapped[User | None] = relationship(back_populates="addresses")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(180), primary_key=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    price_cents: Mapped[int | None] = mapped_column(Integer)
    stock: Mapped[int | None] = mapped_column(Integer)
    weight_grams: Mapped[int | None] = mapped_column(Integer)
    dimensions: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)
    category: Mapped[Category] = relationship(back_populates="products")
    cart_items: Mapped[list[CartItem]] = relationship(back_populates="product")


class Cart(Base):
    __tablename__ = "carts"
    __table_args__ = (UniqueConstraint("user_id", "session_key", name="uq_cart_user_session"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_key: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)
    items: Mapped[list[CartItem]] = relationship(back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("cart_id", "product_id", name="uq_cart_item_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cart_id: Mapped[str] = mapped_column(ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    cart: Mapped[Cart] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(back_populates="cart_items")


class ShippingQuote(Base):
    __tablename__ = "shipping_quotes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    cart_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    destination_postal_code_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    service_id: Mapped[str] = mapped_column(String(80), nullable=False)
    carrier: Mapped[str] = mapped_column(String(120), nullable=False)
    service_name: Mapped[str] = mapped_column(String(120), nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_days: Mapped[int | None] = mapped_column(Integer)
    is_simulation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    idempotency_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    address_id: Mapped[int | None] = mapped_column(ForeignKey("addresses.id", ondelete="SET NULL"))
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    address_snapshot_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    stock_reserved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    inventory_issue: Mapped[str | None] = mapped_column(String(240))
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    shipping_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    shipping_quote_id: Mapped[str] = mapped_column(ForeignKey("shipping_quotes.id"), nullable=False)
    shipping_quote: Mapped[ShippingQuote] = relationship()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)
    user: Mapped[User | None] = relationship(back_populates="orders")
    items: Mapped[list[OrderItem]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payment: Mapped[Payment | None] = relationship(back_populates="order", uselist=False, cascade="all, delete-orphan")
    shipment: Mapped[Shipment | None] = relationship(back_populates="order", uselist=False, cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    order: Mapped[Order] = relationship(back_populates="items")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False, default="mercado_pago")
    external_id: Mapped[str | None] = mapped_column(String(120), unique=True, index=True)
    preference_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    checkout_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="BRL")
    last_webhook_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)
    order: Mapped[Order] = relationship(back_populates="payment")


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False, default="melhor_envio")
    provider_order_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    service_id: Mapped[str] = mapped_column(String(80), nullable=False)
    carrier: Mapped[str] = mapped_column(String(120), nullable=False)
    service_name: Mapped[str] = mapped_column(String(120), nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_days: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    tracking_code: Mapped[str | None] = mapped_column(String(120))
    tracking_url: Mapped[str | None] = mapped_column(String(500))
    label_url: Mapped[str | None] = mapped_column(String(500))
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)
    order: Mapped[Order] = relationship(back_populates="shipment")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

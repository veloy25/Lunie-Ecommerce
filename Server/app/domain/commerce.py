from __future__ import annotations

from dataclasses import dataclass


class ProductNotPurchasable(ValueError):
    pass


@dataclass(frozen=True)
class PricedLine:
    product_id: str
    product_name: str
    unit_price_cents: int
    quantity: int

    @property
    def line_total_cents(self) -> int:
        return self.unit_price_cents * self.quantity


def price_line(product: object, quantity: int) -> PricedLine:
    if quantity < 1:
        raise ProductNotPurchasable("A quantidade deve ser maior que zero.")
    if not getattr(product, "is_active", False):
        raise ProductNotPurchasable("Este produto não está ativo.")
    price = getattr(product, "price_cents", None)
    stock = getattr(product, "stock", None)
    if price is None or price <= 0 or stock is None or stock <= 0:
        raise ProductNotPurchasable("Produto sem preço e estoque cadastrados.")
    if quantity > stock:
        raise ProductNotPurchasable("A quantidade solicitada excede o estoque disponível.")
    return PricedLine(
        product_id=str(getattr(product, "id")),
        product_name=str(getattr(product, "name")),
        unit_price_cents=int(price),
        quantity=quantity,
    )


def cart_fingerprint(items: list[tuple[str, int]]) -> str:
    import hashlib

    stable = "|".join(f"{product_id}:{quantity}" for product_id, quantity in sorted(items))
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()

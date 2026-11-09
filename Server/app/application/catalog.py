from pathlib import Path
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.infrastructure.models import Category, Product


def seed_catalog(session: Session) -> int:
    catalog_path = Path(settings.catalog_path)
    if not catalog_path.is_absolute():
        catalog_path = Path(__file__).resolve().parents[3] / catalog_path
    rows = json.loads(catalog_path.read_text(encoding="utf-8"))
    created = 0
    categories: dict[str, Category] = {}
    for raw in rows:
        category_key = raw["categoryKey"]
        category = categories.get(category_key) or session.get(Category, category_key)
        if category is None:
            category = Category(id=category_key, name=raw["category"])
            session.add(category)
        categories[category_key] = category
        product = session.get(Product, raw["id"])
        if product is None:
            session.add(Product(
                id=raw["id"],
                category_id=raw["categoryKey"],
                name=raw["name"],
                image_path=raw["image"],
                is_active=True,
            ))
            created += 1
        else:
            product.name = raw["name"]
            product.category_id = raw["categoryKey"]
            product.image_path = raw["image"]
    session.commit()
    return created


def get_catalog(session: Session, category: str | None = None, search: str | None = None) -> list[Product]:
    query = select(Product).where(Product.is_active.is_(True))
    if category:
        query = query.join(Category).where(Category.id == category)
    if search:
        query = query.where(Product.name.ilike(f"%{search.strip()}%"))
    return list(session.scalars(query.order_by(Product.name)).all())


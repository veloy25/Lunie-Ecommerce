from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infrastructure.models import Category, Product, User


class SqlProductRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self, product_id: str) -> Product | None:
        return self.session.get(Product, product_id)

    def list_active(self, category: str | None = None, search: str | None = None) -> list[Product]:
        query = select(Product).where(Product.is_active.is_(True))
        if category:
            query = query.join(Category).where(Category.id == category)
        if search:
            query = query.where(Product.name.ilike(f"%{search.strip()}%"))
        return list(self.session.scalars(query.order_by(Product.name)).all())

    def list_all(self) -> list[Product]:
        return list(self.session.scalars(select(Product).order_by(Product.category_id, Product.name)).all())

    def save(self, product: Product) -> Product:
        self.session.add(product)
        self.session.flush()
        return product


class SqlUserRepository:
    def __init__(self, session: Session):
        self.session = session

    def find_by_google_sub(self, subject: str) -> User | None:
        return self.session.scalar(select(User).where(User.google_sub == subject))

    def find_by_email(self, email: str) -> User | None:
        return self.session.scalar(select(User).where(User.email == email.casefold()))

    def save(self, user: User) -> User:
        self.session.add(user)
        self.session.flush()
        return user

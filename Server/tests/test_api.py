from fastapi.testclient import TestClient

from app.main import app


def test_public_catalog_uses_real_products_without_prices() -> None:
    with TestClient(app) as client:
        response = client.get("/api/products")
        assert response.status_code == 200
        products = response.json()
        assert len(products) == 34
        assert all(product["price_cents"] is None and product["stock"] is None for product in products)


def test_shipping_quote_refuses_products_without_confirmed_price_and_stock() -> None:
    with TestClient(app) as client:
        response = client.post("/api/shipping/quotes", json={
            "items": [{"product_id": "sabonetes-liquidos-sabonete-liquido-maracuja", "quantity": 1}],
            "to_postal_code": "01310100",
        })
        assert response.status_code == 422
        assert "preço e estoque" in response.json()["detail"]

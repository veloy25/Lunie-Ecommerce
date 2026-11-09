FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    CATALOG_PATH=/app/catalog/products.json

WORKDIR /app
COPY Server/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY Server/alembic.ini /app/alembic.ini
COPY Server/migrations /app/migrations
COPY Server/app /app/app
COPY catalog /app/catalog

EXPOSE 8000
CMD ["sh", "-c", "alembic -c /app/alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

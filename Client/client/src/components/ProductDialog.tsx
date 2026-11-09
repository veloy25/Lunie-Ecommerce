import { useEffect, useState } from "react";
import type { Product } from "../types";
import { formatProductPrice, isPurchasable } from "../lib/commerce";
import { ShippingEstimator } from "./ShippingEstimator.tsx";

interface ProductDialogProps {
  product: Product;
  csrfToken: string;
  onClose: () => void;
  onAdd: (product: Product, quantity: number) => void;
}

export function ProductDialog({ product, csrfToken, onClose, onAdd }: ProductDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const canBuy = isPurchasable(product);

  useEffect(() => setQuantity(1), [product.id]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <button className="dialog-close" onClick={onClose} aria-label="Fechar detalhes">×</button>
        <div className="product-dialog-image"><img src={product.image} alt={`${product.name} — ${product.category}`} /></div>
        <div className="product-dialog-content">
          <p className="eyebrow">{product.category}</p>
          <h2 id="product-dialog-title">{product.name}</h2>
          <p className="detail-price">{formatProductPrice(product.priceCents)}</p>
          <p className="detail-description">
            {product.description ?? "Detalhes adicionais do produto serão publicados após a revisão do cadastro."}
          </p>
          <div className="availability-note">
            <span className="availability-dot" aria-hidden="true" />
            {canBuy ? "Disponível para compra" : "Preço e estoque precisam ser cadastrados antes da compra."}
          </div>
          {product.weightGrams !== null && <p className="detail-spec">Peso cadastrado: {product.weightGrams} g</p>}
          <ShippingEstimator key={`${product.id}:${quantity}`} lines={[{ product, quantity }]} csrfToken={csrfToken} />
          {canBuy && (
            <div className="purchase-row">
              <label className="quantity-control">
                <span>Quantidade</span>
                <input
                  type="number"
                  min={1}
                  max={product.stock ?? 1}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Math.min(Number(event.target.value) || 1, product.stock ?? 1)))}
                />
              </label>
              <button className="button button-dark" onClick={() => onAdd(product, quantity)}>
                Adicionar à sacola
              </button>
            </div>
          )}
          {!canBuy && <button className="button button-disabled" disabled>Compra indisponível</button>}
        </div>
      </section>
    </div>
  );
}

import type { Product } from "../types";
import { formatProductPrice } from "../lib/commerce";

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
}

export function ProductCard({ product, onOpen }: ProductCardProps) {
  return (
    <article className="product-card group">
      <button className="product-photo" onClick={() => onOpen(product)} aria-label={`Ver detalhes de ${product.name}`}>
        <img src={product.image} alt={`${product.name} — ${product.category}`} loading="lazy" />
        <span className="photo-category">{product.category}</span>
      </button>
      <div className="product-card-copy">
        <div className="flex items-start justify-between gap-3">
          <h3>{product.name}</h3>
          <span className="product-price">{formatProductPrice(product.priceCents)}</span>
        </div>
        <p>Preço e disponibilidade sujeitos a confirmação.</p>
        <button className="text-link" onClick={() => onOpen(product)}>
          Conhecer produto <span aria-hidden="true">↗</span>
        </button>
      </div>
    </article>
  );
}

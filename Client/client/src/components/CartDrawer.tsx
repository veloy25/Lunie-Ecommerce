import type { CartLine } from "../types";
import { cartSubtotalCents, formatBRL } from "../lib/commerce";
import { ShippingEstimator } from "./ShippingEstimator.tsx";

interface CartDrawerProps {
  lines: CartLine[];
  csrfToken: string;
  onClose: () => void;
  onRemove: (productId: string) => void;
  onQuantity: (productId: string, delta: number) => void;
  onCheckout: () => void;
}

export function CartDrawer({ lines, csrfToken, onClose, onRemove, onQuantity, onCheckout }: CartDrawerProps) {
  const subtotal = cartSubtotalCents(lines);

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-header">
          <div><p className="eyebrow">Luniê</p><h2 id="cart-title">Sua sacola</h2></div>
          <button className="dialog-close" onClick={onClose} aria-label="Fechar sacola">×</button>
        </div>
        {lines.length === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-mark" aria-hidden="true">✳</span>
            <h3>Um espaço para o seu próximo ritual.</h3>
            <p>Sua sacola está vazia. Explore o catálogo para conhecer os produtos Luniê.</p>
            <button className="text-link" onClick={onClose}>Voltar ao catálogo <span aria-hidden="true">↗</span></button>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {lines.map(({ product, quantity }) => (
                <article className="cart-line" key={product.id}>
                  <img src={product.image} alt="" />
                  <div className="cart-line-copy">
                    <p className="cart-line-category">{product.category}</p>
                    <h3>{product.name}</h3>
                    <p>{formatBRL((product.priceCents ?? 0) * quantity)}</p>
                    <div className="cart-line-actions">
                      <button aria-label={`Diminuir ${product.name}`} onClick={() => onQuantity(product.id, -1)}>−</button>
                      <span aria-live="polite">{quantity}</span>
                      <button aria-label={`Aumentar ${product.name}`} onClick={() => onQuantity(product.id, 1)}>+</button>
                      <button className="remove-link" onClick={() => onRemove(product.id)}>Remover</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <ShippingEstimator key={lines.map(({ product, quantity }) => `${product.id}:${quantity}`).join("|")} lines={lines} csrfToken={csrfToken} />
            <div className="cart-summary">
              <div className="flex justify-between"><span>Subtotal</span><strong>{formatBRL(subtotal)}</strong></div>
              <p>Frete calculado no checkout.</p>
              <button className="button button-dark w-full" onClick={onCheckout}>Continuar para entrega</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

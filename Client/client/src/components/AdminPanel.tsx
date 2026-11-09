import { useEffect, useState } from "react";
import type { Product, ProductDimensions } from "../types";
import { apiRequest } from "../lib/api";
import { formatBRL, parsePriceToCents } from "../lib/commerce";

interface AdminPanelProps {
  csrfToken: string;
  onClose: () => void;
  onSaved: () => void;
}

interface ProductDraft {
  price: string;
  stock: string;
  weight: string;
  width: string;
  height: string;
  length: string;
  description: string;
}

interface AdminOrder {
  id: string;
  email: string;
  status: string;
  payment_status: string | null;
  shipment_status: string | null;
  carrier: string | null;
  service: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  label_url: string | null;
  inventory_issue: string | null;
  total_cents: number;
  created_at: string;
}

interface AdminConfig {
  environment: string;
  google_login_configured: boolean;
  payments_configured: boolean;
  payment_webhook_configured: boolean;
  shipping_configured: boolean;
  shipping_sandbox: boolean;
  shipping_simulation: boolean;
  pii_encryption_key_configured: boolean;
}

function toDraft(product: Product): ProductDraft {
  return {
    price: product.priceCents === null ? "" : (product.priceCents / 100).toFixed(2).replace(".", ","),
    stock: product.stock === null ? "" : String(product.stock),
    weight: product.weightGrams === null ? "" : String(product.weightGrams),
    width: product.dimensions ? String(product.dimensions.widthCm) : "",
    height: product.dimensions ? String(product.dimensions.heightCm) : "",
    length: product.dimensions ? String(product.dimensions.lengthCm) : "",
    description: product.description ?? "",
  };
}

export function AdminPanel({ csrfToken, onClose, onSaved }: AdminPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [labeling, setLabeling] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Record<string, unknown>[]>("/admin/products")
      .then((rows) => {
        const parsed = rows.map((row) => {
          const dimensions = row.dimensions as Record<string, number> | null;
          const product: Product = {
            id: String(row.id), name: String(row.name), category: String(row.category),
            categoryKey: String(row.category_key), image: String(row.image_path),
            priceCents: row.price_cents == null ? null : Number(row.price_cents),
            stock: row.stock == null ? null : Number(row.stock),
            weightGrams: row.weight_grams == null ? null : Number(row.weight_grams),
            dimensions: dimensions ? {
              widthCm: Number(dimensions.width_cm), heightCm: Number(dimensions.height_cm), lengthCm: Number(dimensions.length_cm),
            } : null,
            description: row.description == null ? null : String(row.description),
            active: Boolean(row.is_active),
          };
          return product;
        });
        setProducts(parsed);
        setDrafts(Object.fromEntries(parsed.map((product) => [product.id, toDraft(product)])));
      })
      .catch((reason: unknown) => {
        if (reason && typeof reason === "object" && "status" in reason && reason.status === 401) {
          setError("Entre com a conta Google autorizada para acessar o painel administrativo.");
        } else if (reason && typeof reason === "object" && "status" in reason && reason.status === 403) {
          setError("Esta conta não tem a função administrativa da loja.");
        } else setError(reason instanceof Error ? reason.message : "Painel administrativo indisponível.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiRequest<AdminOrder[]>("/admin/orders").then(setOrders).catch(() => undefined);
    apiRequest<AdminConfig>("/admin/config").then(setConfig).catch(() => undefined);
  }, []);

  function updateDraft(id: string, field: keyof ProductDraft, value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  async function saveProduct(product: Product) {
    const draft = drafts[product.id];
    const dimensionsValues = [draft.width, draft.height, draft.length].map((value) => value.trim());
    const parsedPrice = parsePriceToCents(draft.price);
    const parsedStock = draft.stock.trim() ? Number(draft.stock) : null;
    const parsedWeight = draft.weight.trim() ? Number(draft.weight) : null;
    if (draft.price.trim() && parsedPrice === null) {
      setError("Informe um preço válido, por exemplo 29,90.");
      return;
    }
    if (parsedStock !== null && (!Number.isInteger(parsedStock) || parsedStock < 0)) {
      setError("O estoque deve ser um número inteiro igual ou maior que zero.");
      return;
    }
    if (parsedWeight !== null && (!Number.isInteger(parsedWeight) || parsedWeight < 1)) {
      setError("O peso deve ser um número inteiro em gramas.");
      return;
    }
    if (dimensionsValues.some(Boolean) && dimensionsValues.some((value) => !value || !Number.isFinite(Number(value)) || Number(value) <= 0)) {
      setError("Preencha largura, altura e comprimento com medidas válidas.");
      return;
    }
    let dimensions: ProductDimensions | null = null;
    if (dimensionsValues.some(Boolean)) {
      dimensions = {
        widthCm: Number(draft.width), heightCm: Number(draft.height), lengthCm: Number(draft.length),
      };
    }
    setSaving(product.id);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          price_cents: parsedPrice,
          stock: parsedStock,
          weight_grams: parsedWeight,
          dimensions: dimensions ? { width_cm: dimensions.widthCm, height_cm: dimensions.heightCm, length_cm: dimensions.lengthCm } : null,
          description: draft.description.trim() || null,
        }),
      }, csrfToken);
      setMessage(`${product.name} atualizado.`);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o produto.");
    } finally {
      setSaving(null);
    }
  }

  async function createLabel(order: AdminOrder) {
    setLabeling(order.id);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<{ tracking_url: string | null; label_url: string | null }>(`/admin/orders/${encodeURIComponent(order.id)}/shipment/label`, { method: "POST" }, csrfToken);
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, shipment_status: "released", tracking_url: result.tracking_url, label_url: result.label_url } : item));
      setMessage("Etiqueta solicitada ao Melhor Envio.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível gerar a etiqueta.");
    } finally {
      setLabeling(null);
    }
  }

  return (
    <div className="dialog-backdrop admin-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <div className="admin-topline"><div><p className="eyebrow">Luniê · gestão</p><h2 id="admin-title">Catálogo</h2></div><button className="dialog-close" onClick={onClose} aria-label="Fechar painel">×</button></div>
        <p className="admin-intro">Cadastre preço, estoque e dimensões reais. Os valores são validados pela API antes de ficarem disponíveis para compra.</p>
        {loading && <p className="status-note">Carregando catálogo…</p>}
        {error && <p className="form-notice" role="alert">{error}</p>}
        {message && <p className="success-notice" role="status">{message}</p>}
        {config && <section className="admin-config"><div><p className="eyebrow">Ambiente</p><strong>{config.environment}</strong></div><span className={config.google_login_configured ? "config-ready" : "config-pending"}>Google {config.google_login_configured ? "conectado" : "pendente"}</span><span className={config.payments_configured && config.payment_webhook_configured ? "config-ready" : "config-pending"}>Mercado Pago {config.payments_configured && config.payment_webhook_configured ? "pronto" : "pendente"}</span><span className={config.shipping_configured ? "config-ready" : "config-pending"}>Melhor Envio {config.shipping_configured ? config.shipping_sandbox ? "sandbox" : "conectado" : "pendente"}</span><span className={config.shipping_simulation ? "config-pending" : config.pii_encryption_key_configured ? "config-ready" : "config-pending"}>Criptografia PII {config.pii_encryption_key_configured ? "configurada" : "pendente"}</span><small>Tokens e chaves são definidos nas variáveis protegidas do ambiente, nunca neste painel.</small></section>}
        <section className="admin-orders"><div className="admin-section-heading"><div><p className="eyebrow">Pedidos recentes</p><h3>Pedidos e entregas</h3></div><span>{orders.length}</span></div>
          {orders.length === 0 ? <p className="status-note">Nenhum pedido registrado.</p> : orders.map((order) => <article className="admin-order" key={order.id}><div className="admin-order-main"><strong>#{order.id.slice(0, 8)} · {formatBRL(order.total_cents)}</strong><span>{order.email}</span><small>{new Date(order.created_at).toLocaleString("pt-BR")} · pagamento {order.payment_status ?? order.status}</small></div><div className="admin-order-shipping"><span>{order.carrier ? `${order.carrier} · ${order.service}` : "Frete pendente"}</span><small>{order.shipment_status ?? "Sem etiqueta"}{order.tracking_code ? ` · ${order.tracking_code}` : ""}</small>{order.inventory_issue && <small className="form-notice">{order.inventory_issue}</small>}{order.payment_status === "approved" && order.shipment_status !== "released" && <button className="button button-outline" onClick={() => createLabel(order)} disabled={labeling === order.id}>{labeling === order.id ? "Solicitando…" : "Comprar e gerar etiqueta"}</button>}{order.label_url && <a className="text-link" href={order.label_url} target="_blank" rel="noreferrer">Imprimir etiqueta ↗</a>}{order.tracking_url && <a className="text-link" href={order.tracking_url} target="_blank" rel="noreferrer">Abrir rastreio ↗</a>}</div></article>)}
        </section>
        {!loading && products.length > 0 && (
          <div className="admin-product-list">
            {products.map((product) => {
              const draft = drafts[product.id];
              return (
                <details className="admin-product" key={product.id}>
                  <summary><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{product.category}</small></span><span className="admin-status">{product.priceCents !== null && product.stock !== null ? "Configurado" : "Pendente"}</span></summary>
                  {draft && <div className="admin-fields">
                    <label>Preço (R$)<input inputMode="decimal" placeholder="0,00" value={draft.price} onChange={(event) => updateDraft(product.id, "price", event.target.value)} /></label>
                    <label>Estoque (un.)<input type="number" min="0" step="1" value={draft.stock} onChange={(event) => updateDraft(product.id, "stock", event.target.value)} /></label>
                    <label>Peso (g)<input type="number" min="1" step="1" value={draft.weight} onChange={(event) => updateDraft(product.id, "weight", event.target.value)} /></label>
                    <label>Largura (cm)<input type="number" min="0.1" step="0.1" value={draft.width} onChange={(event) => updateDraft(product.id, "width", event.target.value)} /></label>
                    <label>Altura (cm)<input type="number" min="0.1" step="0.1" value={draft.height} onChange={(event) => updateDraft(product.id, "height", event.target.value)} /></label>
                    <label>Comprimento (cm)<input type="number" min="0.1" step="0.1" value={draft.length} onChange={(event) => updateDraft(product.id, "length", event.target.value)} /></label>
                    <label className="admin-description">Descrição aprovada<textarea rows={2} value={draft.description} onChange={(event) => updateDraft(product.id, "description", event.target.value)} /></label>
                    <button className="button button-dark" onClick={() => saveProduct(product)} disabled={saving === product.id}>{saving === product.id ? "Salvando…" : "Salvar produto"}</button>
                  </div>}
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

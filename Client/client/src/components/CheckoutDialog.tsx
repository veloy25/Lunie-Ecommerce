import { useState, type FormEvent } from "react";
import type { CartLine, ShippingOption } from "../types";
import { apiRequest } from "../lib/api";
import { formatBRL } from "../lib/commerce";

interface CheckoutDialogProps {
  lines: CartLine[];
  csrfToken: string;
  onClose: () => void;
}

interface CheckoutAddress {
  name: string;
  email: string;
  phone: string;
  document: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

const emptyAddress: CheckoutAddress = {
  name: "", email: "", phone: "", document: "", postal_code: "", street: "", number: "",
  complement: "", district: "", city: "", state: "",
};

export function CheckoutDialog({ lines, csrfToken, onClose }: CheckoutDialogProps) {
  const [address, setAddress] = useState(emptyAddress);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => window.crypto.randomUUID());

  function setField(field: keyof CheckoutAddress, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
    if (field === "postal_code") {
      setOptions([]);
      setSelected("");
    }
  }

  async function getQuotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest<{ quotes: ShippingOption[] }>("/shipping/quotes", {
        method: "POST",
        body: JSON.stringify({
          items: lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
          to_postal_code: address.postal_code.replace(/\D/g, ""),
        }),
      }, csrfToken);
      setOptions(result.quotes);
      setSelected(result.quotes[0]?.id ?? "");
      if (result.quotes.length === 0) setNotice("Nenhuma modalidade de entrega foi retornada para este CEP.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível cotar o frete.");
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest<{ checkout_url: string }>("/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          items: lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
          email: address.email,
          address,
          shipping_quote_id: selected,
        }),
      }, csrfToken);
      window.location.assign(result.checkout_url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível criar o pedido.");
      if (error && typeof error === "object" && "status" in error && error.status === 409) {
        setOptions([]);
        setSelected("");
      }
      if (error && typeof error === "object" && "status" in error && error.status !== 0) {
        setIdempotencyKey(window.crypto.randomUUID());
      }
    } finally {
      setBusy(false);
    }
  }

  const deliveryFormReady = Object.values(address).every((value) => value.trim().length > 0 || value === address.complement);

  return (
    <div className="dialog-backdrop checkout-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <button className="dialog-close" onClick={onClose} aria-label="Fechar checkout">×</button>
        <div className="checkout-heading">
          <p className="eyebrow">Quase lá</p>
          <h2 id="checkout-title">Entrega e pagamento</h2>
          <p>O pedido e o valor serão recalculados no servidor antes do pagamento.</p>
        </div>
        <form onSubmit={options.length ? placeOrder : getQuotes} className="checkout-form">
          <div className="checkout-fields">
            <label>Nome completo<input required autoComplete="name" value={address.name} onChange={(event) => setField("name", event.target.value)} /></label>
            <label>E-mail<input required type="email" autoComplete="email" value={address.email} onChange={(event) => setField("email", event.target.value)} /></label>
            <label>Telefone com DDD<input required type="tel" autoComplete="tel" value={address.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
            <label>CPF<input required inputMode="numeric" autoComplete="off" maxLength={14} value={address.document} onChange={(event) => setField("document", event.target.value)} /></label>
            <label>CEP<input required inputMode="numeric" autoComplete="postal-code" maxLength={9} value={address.postal_code} onChange={(event) => setField("postal_code", event.target.value)} /></label>
            <label>Endereço<input required autoComplete="street-address" value={address.street} onChange={(event) => setField("street", event.target.value)} /></label>
            <label>Número<input required value={address.number} onChange={(event) => setField("number", event.target.value)} /></label>
            <label>Complemento<input value={address.complement} onChange={(event) => setField("complement", event.target.value)} /></label>
            <label>Bairro<input required value={address.district} onChange={(event) => setField("district", event.target.value)} /></label>
            <label>Cidade<input required autoComplete="address-level2" value={address.city} onChange={(event) => setField("city", event.target.value)} /></label>
            <label>UF<input required autoComplete="address-level1" minLength={2} maxLength={2} value={address.state} onChange={(event) => setField("state", event.target.value.toUpperCase())} /></label>
          </div>

          {options.length > 0 && (
            <fieldset className="shipping-options">
              <legend>Escolha a modalidade de frete</legend>
              {options.map((option) => (
                <label className="shipping-option" key={option.id}>
                  <input type="radio" name="shipping" value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} />
                  <span><strong>{option.carrier} · {option.service}</strong><small>{option.deliveryDays === null ? "Prazo informado após confirmação" : `${option.deliveryDays} dias úteis`}{option.simulation ? " · simulação de desenvolvimento" : ""}</small></span>
                  <b>{formatBRL(option.priceCents)}</b>
                </label>
              ))}
            </fieldset>
          )}

          {notice && <p className="form-notice" role="alert">{notice}</p>}
          <button className="button button-dark w-full" disabled={busy || (options.length > 0 && !selected) || (!options.length && !deliveryFormReady)}>
            {busy ? "Aguarde…" : options.length ? "Criar pedido e ir ao Mercado Pago" : "Calcular frete"}
          </button>
          <p className="checkout-privacy">CPF, telefone e endereço são usados para processar a entrega e serão compartilhados com a transportadora após o pagamento.</p>
        </form>
      </section>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import type { CartLine, ShippingOption } from "../types";
import { apiRequest } from "../lib/api";
import { formatBRL, isPurchasable } from "../lib/commerce";

interface ShippingEstimatorProps {
  lines: CartLine[];
  csrfToken: string;
}

export function ShippingEstimator({ lines, csrfToken }: ShippingEstimatorProps) {
  const [postalCode, setPostalCode] = useState("");
  const [quotes, setQuotes] = useState<ShippingOption[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canQuote = lines.length > 0 && lines.every(({ product }) => isPurchasable(product));

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setQuotes([]);
    setBusy(true);
    try {
      const result = await apiRequest<{ quotes: ShippingOption[] }>("/shipping/quotes", {
        method: "POST",
        body: JSON.stringify({
          items: lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
          to_postal_code: postalCode.replace(/\D/g, ""),
        }),
      }, csrfToken);
      setQuotes(result.quotes);
      if (!result.quotes.length) setNotice("Nenhuma modalidade foi encontrada para este CEP.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível calcular o frete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shipping-estimator" aria-label="Calcular frete">
      <p className="eyebrow">Entrega</p>
      <form className="shipping-estimate-form" onSubmit={calculate}>
        <label htmlFor="shipping-estimate-cep">Consulte o frete pelo CEP</label>
        <div><input id="shipping-estimate-cep" inputMode="numeric" autoComplete="postal-code" maxLength={9} required minLength={8} placeholder="00000-000" value={postalCode} onChange={(event) => { setPostalCode(event.target.value); setQuotes([]); }} /><button type="submit" disabled={busy || !canQuote}>{busy ? "Consultando…" : "Calcular"}</button></div>
      </form>
      {!canQuote && <p className="shipping-estimate-note">Cadastre preço e estoque para consultar o frete.</p>}
      {notice && <p className="shipping-estimate-note" role="status">{notice}</p>}
      {quotes.length > 0 && <ul className="shipping-estimate-results">{quotes.map((quote) => <li key={quote.id}><span>{quote.carrier} · {quote.service}<small>{quote.deliveryDays === null ? "Prazo a confirmar" : `${quote.deliveryDays} dias úteis`}{quote.simulation ? " · simulação" : ""}</small></span><strong>{formatBRL(quote.priceCents)}</strong></li>)}</ul>}
    </section>
  );
}

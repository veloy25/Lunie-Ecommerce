import type { CartLine, Product } from "../types";

export function isPurchasable(product: Product): boolean {
  return Number.isInteger(product.priceCents)
    && Number(product.priceCents) > 0
    && Number.isInteger(product.stock)
    && Number(product.stock) > 0
    && product.active;
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((total, line) => {
    if (!isPurchasable(line.product) || line.product.priceCents === null) return total;
    return total + line.product.priceCents * line.quantity;
  }, 0);
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatProductPrice(cents: number | null): string {
  return cents === null ? "Preço a confirmar" : formatBRL(cents);
}

export function parsePriceToCents(value: string): number | null {
  const trimmed = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

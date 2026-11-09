import { describe, expect, it } from "vitest";
import { cartCount, cartSubtotalCents, isPurchasable, parsePriceToCents } from "./commerce";
import type { CartLine, Product } from "../types";

const product: Product = {
  id: "sabonete-lavanda",
  name: "Sabonete Lavanda",
  category: "Sabonetes",
  categoryKey: "sabonetes",
  image: "/products/sabonete-lavanda.jpg",
  priceCents: 2490,
  stock: 3,
  weightGrams: null,
  dimensions: null,
  description: null,
  active: true,
};

describe("commerce rules", () => {
  it("only allows products with an active price and stock", () => {
    expect(isPurchasable(product)).toBe(true);
    expect(isPurchasable({ ...product, stock: 0 })).toBe(false);
    expect(isPurchasable({ ...product, priceCents: null })).toBe(false);
    expect(isPurchasable({ ...product, active: false })).toBe(false);
  });

  it("calculates item count and subtotal in integer cents", () => {
    const lines: CartLine[] = [{ product, quantity: 2 }];
    expect(cartCount(lines)).toBe(2);
    expect(cartSubtotalCents(lines)).toBe(4980);
  });

  it("parses Brazilian and decimal currency input without shifting cents", () => {
    expect(parsePriceToCents("1.299,90")).toBe(129990);
    expect(parsePriceToCents("12.50")).toBe(1250);
    expect(parsePriceToCents("R$ 29,9")).toBe(2990);
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("12,345")).toBeNull();
  });
});

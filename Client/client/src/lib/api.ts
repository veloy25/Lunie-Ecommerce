import type { Product, ProductDimensions } from "../types";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, csrfToken?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError("A API da loja não está conectada.", 0);
  }

  const body = await response.json().catch(() => ({})) as { detail?: string };
  if (!response.ok) {
    throw new ApiError(body.detail ?? "Não foi possível concluir esta ação.", response.status);
  }
  return body as T;
}

function normalizeProduct(raw: Record<string, unknown>): Product {
  const dimensionsRaw = (raw.dimensions ?? null) as Record<string, number> | null;
  const dimensions: ProductDimensions | null = dimensionsRaw
    ? {
        widthCm: Number(dimensionsRaw.width_cm ?? dimensionsRaw.widthCm),
        heightCm: Number(dimensionsRaw.height_cm ?? dimensionsRaw.heightCm),
        lengthCm: Number(dimensionsRaw.length_cm ?? dimensionsRaw.lengthCm),
      }
    : null;
  const price = raw.price_cents ?? raw.priceCents ?? null;
  const stock = raw.stock ?? null;

  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    category: String(raw.category ?? ""),
    categoryKey: String(raw.category_key ?? raw.categoryKey ?? ""),
    image: String(raw.image_path ?? raw.image ?? ""),
    priceCents: price === null ? null : Number(price),
    stock: stock === null ? null : Number(stock),
    weightGrams: raw.weight_grams == null && raw.weightGrams == null
      ? null
      : Number(raw.weight_grams ?? raw.weightGrams),
    dimensions,
    description: raw.description == null ? null : String(raw.description),
    active: Boolean(raw.is_active ?? raw.active ?? true),
  };
}

export async function loadProducts(): Promise<Product[]> {
  try {
    const remote = await apiRequest<Record<string, unknown>[]>("/products");
    return remote.map(normalizeProduct).filter((product) => product.active);
  } catch {
    const response = await fetch("/products.json");
    if (!response.ok) throw new Error("O catálogo não pôde ser carregado.");
    const local = await response.json() as Record<string, unknown>[];
    return local.map(normalizeProduct).filter((product) => product.active);
  }
}

export function apiBaseUrl(): string {
  return API_BASE;
}

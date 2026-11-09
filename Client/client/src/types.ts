export interface ProductDimensions {
  widthCm: number;
  heightCm: number;
  lengthCm: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  categoryKey: string;
  image: string;
  priceCents: number | null;
  stock: number | null;
  weightGrams: number | null;
  dimensions: ProductDimensions | null;
  description: string | null;
  active: boolean;
}

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface ShippingOption {
  id: string;
  carrier: string;
  service: string;
  priceCents: number;
  deliveryDays: number | null;
  simulation: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: "customer" | "admin";
}

// ────────────────────────────────────────────────────────────────
// src/services/api.ts
// Thin wrapper around the backend REST API. The base URL comes from
// NEXT_PUBLIC_API_URL so it works in both local dev and production.
// ────────────────────────────────────────────────────────────────

import type { Order, Stats, OrderStatus } from "@/types/order";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

// Map a status to its dedicated list endpoint.
const STATUS_PATH: Record<OrderStatus, string> = {
  INQUIRY: "/api/orders/inquiries",
  CONFIRMED: "/api/orders/confirmed",
  CANCELLED: "/api/orders/cancelled",
};

export const api = {
  getOrdersByStatus: (status: OrderStatus) =>
    getJson<Order[]>(STATUS_PATH[status]),
  getAllOrders: () => getJson<Order[]>("/api/orders"),
  getOrder: (id: string) => getJson<Order>(`/api/orders/${id}`),
  getStats: () => getJson<Stats>("/api/orders/stats"),
};

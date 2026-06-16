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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Surface the backend's error message (e.g. WhatsApp 24h-window rejection).
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return data as T;
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

  // Manual seller controls
  sendMessage: (id: string, text: string) =>
    postJson<Order>(`/api/orders/${id}/message`, { text }),
  setStatus: (id: string, status: OrderStatus) =>
    postJson<Order>(`/api/orders/${id}/status`, { status }),
  setAutoReply: (id: string, enabled: boolean) =>
    postJson<Order>(`/api/orders/${id}/auto-reply`, { enabled }),
};

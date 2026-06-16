// ────────────────────────────────────────────────────────────────
// src/services/api.ts
// Thin wrapper around the backend REST API. The base URL comes from
// NEXT_PUBLIC_API_URL so it works in both local dev and production.
// ────────────────────────────────────────────────────────────────

import type { Order, Stats, OrderStatus, ReorderCustomer } from "@/types/order";

// On Render, the backend's URL is injected as just a hostname (no scheme), so
// we prepend https:// when needed. Locally it's the full http://localhost:3000.
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const BASE_URL = /^https?:\/\//.test(RAW_API_URL)
  ? RAW_API_URL
  : `https://${RAW_API_URL}`;

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
  DELIVERED: "/api/orders/delivered",
  COMPLETED: "/api/orders/completed",
  CANCELLED: "/api/orders/cancelled",
};

export const api = {
  getOrdersByStatus: (status: OrderStatus) =>
    getJson<Order[]>(STATUS_PATH[status]),
  getAllOrders: () => getJson<Order[]>("/api/orders"),
  getOrder: (id: string) => getJson<Order>(`/api/orders/${id}`),
  getStats: () => getJson<Stats>("/api/orders/stats"),
  getReorders: () => getJson<ReorderCustomer[]>("/api/orders/reorders"),

  // Manual seller controls
  sendMessage: (id: string, text: string) =>
    postJson<Order>(`/api/orders/${id}/message`, { text }),
  setStatus: (id: string, status: OrderStatus) =>
    postJson<Order>(`/api/orders/${id}/status`, { status }),
  setAutoReply: (id: string, enabled: boolean) =>
    postJson<Order>(`/api/orders/${id}/auto-reply`, { enabled }),
  markRead: (id: string) => postJson<Order>(`/api/orders/${id}/read`, {}),
};

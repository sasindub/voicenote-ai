// ────────────────────────────────────────────────────────────────
// src/hooks/useOrders.ts
// Client-side hooks that fetch data and POLL every few seconds so the
// dashboard "reflects changes immediately" (PRD Definition of Done) as
// new WhatsApp orders arrive — no manual refresh needed.
// ────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import type { Order, Stats, OrderStatus } from "@/types/order";

const POLL_MS = 5000;

export function useOrders(status: OrderStatus) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getOrdersByStatus(status);
      setOrders(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return { orders, loading, error, reload: load };
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setStats(await api.getStats());
      } catch {
        /* ignore transient errors; next poll retries */
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return stats;
}

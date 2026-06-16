// ────────────────────────────────────────────────────────────────
// StatsCards — the three top cards (PRD): Inquiries / Confirmed /
// Cancelled counts. Polls the backend via useStats().
// ────────────────────────────────────────────────────────────────

"use client";

import { MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStats } from "@/hooks/useOrders";

export function StatsCards() {
  const stats = useStats();

  const cards = [
    {
      label: "Inquiries",
      value: stats?.inquiry ?? "—",
      icon: MessageSquare,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Confirmed Orders",
      value: stats?.confirmed ?? "—",
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Cancelled Orders",
      value: stats?.cancelled ?? "—",
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`rounded-full p-3 ${c.bg}`}>
              <c.icon className={`h-6 w-6 ${c.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

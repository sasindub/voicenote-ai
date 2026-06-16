// /dashboard/reorders — customers who have COMPLETED 2+ orders, ranked by
// number of completed orders (most loyal first).

"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api";
import type { ReorderCustomer } from "@/types/order";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function ReordersPage() {
  const [rows, setRows] = useState<ReorderCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setRows(await api.getReorders());
      } catch {
        /* ignore; next poll retries */
      } finally {
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Completed Orders</TableHead>
            <TableHead>Last Order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No repeat customers yet. Customers with 2+ completed orders appear here.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => (
            <TableRow key={r.phoneNumber}>
              <TableCell className="font-semibold">#{i + 1}</TableCell>
              <TableCell className="font-medium">{r.customerName?.trim() || "—"}</TableCell>
              <TableCell>{r.phoneNumber.replace("whatsapp:", "")}</TableCell>
              <TableCell>
                <Badge variant="returning" className="gap-1">
                  <Repeat className="h-3 w-3" /> {r.completedCount}
                </Badge>
              </TableCell>
              <TableCell>{r.lastOrderDate ? formatDate(r.lastOrderDate) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// OrderDetailDialog — the "click an order" detail screen.
// Shows customer info (with per-field copy), an auto-reply switch,
// manual Confirm/Cancel buttons, the full conversation, and a box to
// manually message the customer. Polls the single order while open so
// the seller sees new customer messages live.
// ────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, Copy, Check, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/services/api";
import type { Order, OrderStatus } from "@/types/order";

function cleanPhone(p: string) {
  return p.replace("whatsapp:", "");
}

// A label + value with a small copy button (copies just that value).
function CopyableField({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  const text = value && value.trim() ? value : "";

  const copy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium break-words">{text || "—"}</p>
      </div>
      {text && (
        <button
          onClick={copy}
          title={`Copy ${label}`}
          className="mt-4 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [current, setCurrent] = useState<Order | null>(order);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = order?._id;

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setCurrent(await api.getOrder(id));
    } catch {
      /* keep showing last good data; next poll retries */
    }
  }, [id]);

  // On open: seed with the passed order, then fetch fresh + poll every 3s.
  useEffect(() => {
    if (!open || !id) return;
    setCurrent(order);
    setError(null);
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [open, id, order, refresh]);

  if (!current) return null;

  const autoReply = current.autoReplyEnabled !== false;

  const toggleAutoReply = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setCurrent(await api.setAutoReply(current._id, enabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: OrderStatus) => {
    setBusy(true);
    setError(null);
    try {
      setCurrent(await api.setStatus(current._id, status));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.sendMessage(current._id, text);
      setCurrent(updated);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>
              {current.customerName?.trim() ? current.customerName : "Unknown customer"}
            </DialogTitle>
            <StatusBadge status={current.status} />
          </div>
          <p className="text-sm text-muted-foreground">{cleanPhone(current.phoneNumber)}</p>
        </DialogHeader>

        {/* Auto-reply switch + manual status controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Switch checked={autoReply} onCheckedChange={toggleAutoReply} disabled={busy} />
            <div>
              <p className="text-sm font-medium">
                {autoReply ? "Auto-reply ON" : "Manual mode"}
              </p>
              <p className="text-xs text-muted-foreground">
                {autoReply
                  ? "Bot answers this customer automatically."
                  : "Bot is silent — you reply manually below."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="success"
              disabled={busy || current.status === "CONFIRMED"}
              onClick={() => changeStatus("CONFIRMED")}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || current.status === "CANCELLED"}
              onClick={() => changeStatus("CANCELLED")}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Customer + order details with per-field copy */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border p-4">
          <CopyableField label="Name" value={current.customerName} />
          <CopyableField label="Phone" value={cleanPhone(current.phoneNumber)} />
          <CopyableField label="Email" value={current.email} />
          <CopyableField label="Address" value={current.address} />
          <CopyableField label="Product" value={current.product} />
          <CopyableField label="Size" value={current.size} />
          <CopyableField label="Color" value={current.color} />
          <CopyableField label="Quantity" value={current.quantity} />
        </div>

        {current.summary?.trim() && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <span className="font-semibold">Summary: </span>
            {current.summary}
          </div>
        )}

        {/* Full conversation history */}
        <div>
          <p className="mb-2 text-sm font-semibold">Conversation</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {current.messages.map((m, i) => {
              const isCustomer = m.sender === "customer";
              const isAgent = m.sender === "agent";
              const bubble = isCustomer
                ? "bg-secondary text-secondary-foreground"
                : isAgent
                ? "bg-blue-600 text-white"
                : "bg-primary text-primary-foreground";
              const senderLabel = isCustomer ? "" : isAgent ? "You" : "Bot";
              return (
                <div key={i} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${bubble}`}>
                    {senderLabel && (
                      <span className="mr-1 text-[10px] font-semibold uppercase opacity-80">
                        {senderLabel}
                      </span>
                    )}
                    {m.messageType === "voice" && (
                      <span className="mr-1 inline-flex items-center gap-1 text-xs opacity-80">
                        <Mic className="h-3 w-3" /> voice
                      </span>
                    )}
                    {m.message}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Manual message composer */}
        <div className="space-y-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Input
              placeholder="Type a message to send on WhatsApp…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy}
            />
            <Button onClick={send} disabled={busy || !message.trim()}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sends a WhatsApp message to {cleanPhone(current.phoneNumber)} and logs it as “You”.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

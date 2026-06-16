// ────────────────────────────────────────────────────────────────
// src/models/Order.js
// The Mongoose schema for an order. One document per customer order /
// inquiry. The full chat history lives INSIDE the order as a `messages`
// array (embedded sub-documents) — exactly as the PRD specifies.
// ────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

// The three (and only three) order statuses from the PRD.
const ORDER_STATUS = {
  INQUIRY: 'INQUIRY',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
};

// Each chat message stored inside an order.
// sender: who sent it —
//   "customer" = the buyer, "bot" = the AI auto-reply,
//   "agent"    = a manual message the seller typed from the dashboard.
// messageType: "text" or "voice" (voice notes are transcribed to text first).
const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['customer', 'bot', 'agent'], required: true },
    messageType: { type: String, enum: ['text', 'voice'], default: 'text' },
    message: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false } // messages don't need their own ids
);

const orderSchema = new mongoose.Schema(
  {
    // The customer's WhatsApp number, normalized (e.g. "+94771234567").
    phoneNumber: { type: String, required: true, index: true },

    // Order detail fields — all start empty and get filled by the AI as the
    // conversation progresses. Strings (size/quantity kept as strings so we
    // can store things like "40" or "two pairs" without type errors).
    customerName: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    product: { type: String, default: '' },
    size: { type: String, default: '' },
    color: { type: String, default: '' },
    quantity: { type: String, default: '' },

    // INQUIRY → CONFIRMED → (or) CANCELLED.
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.INQUIRY,
      index: true,
    },

    // AI-generated plain-text summary shown in the dashboard.
    summary: { type: String, default: '' },

    // Per-customer auto-reply switch. When false, the bot stops replying to
    // this number and the seller chats manually (the AI still updates order
    // details silently). Kept in sync across all orders for the same number.
    autoReplyEnabled: { type: Boolean, default: true },

    // Full conversation history.
    messages: { type: [messageSchema], default: [] },
  },
  {
    // Mongoose auto-manages createdAt / updatedAt timestamps.
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = { Order, ORDER_STATUS };

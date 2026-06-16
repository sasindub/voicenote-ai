// ────────────────────────────────────────────────────────────────
// src/services/orderService.js
// The business logic that ties everything together. This is where the
// PRD's customer flow lives:
//
//   message in → find/create the active order → log it → AI extract →
//   update fields → decide status (INQUIRY/CONFIRMED/CANCELLED) → reply
//
// The AI writes the reply text and extracts fields, but THIS file owns the
// authoritative status decision so the rules are predictable.
// ────────────────────────────────────────────────────────────────

const { Order, ORDER_STATUS, CLOSED_STATUSES } = require('../models/Order');
const { extractOrder } = require('../ai/orderExtractor');
const logger = require('../utils/logger');

// Fields the AI can fill on the order document.
const FIELD_KEYS = ['product', 'size', 'color', 'quantity', 'customerName', 'address', 'email'];

// Fields we carry over from a returning customer's last completed order.
const REUSABLE_FIELDS = ['customerName', 'address', 'email'];

/**
 * Create a brand-new INQUIRY order for a number. If the customer has COMPLETED
 * an order before, mark them as returning and pre-fill their known contact
 * details (so re-orders are fast and the bot can say "same address as before?").
 *
 * @param {string} phoneNumber
 * @returns {Promise<import('mongoose').Document>}
 */
async function createNewOrder(phoneNumber) {
  // Most recent order (any status) — used to inherit the auto-reply setting.
  const latestAny = await Order.findOne({ phoneNumber }).sort({ createdAt: -1 });
  const inheritedAutoReply = latestAny ? latestAny.autoReplyEnabled !== false : true;

  // Most recent COMPLETED order — defines "returning customer" + prefill source.
  const lastCompleted = await Order.findOne({
    phoneNumber,
    status: ORDER_STATUS.COMPLETED,
  }).sort({ createdAt: -1 });

  const data = {
    phoneNumber,
    status: ORDER_STATUS.INQUIRY,
    autoReplyEnabled: inheritedAutoReply,
    isReturningCustomer: Boolean(lastCompleted),
  };

  // Pre-fill contact details from their last completed order.
  if (lastCompleted) {
    for (const key of REUSABLE_FIELDS) {
      if (lastCompleted[key]) data[key] = lastCompleted[key];
    }
  }

  return Order.create(data);
}

/**
 * Find the OPEN order this message belongs to, or create a new one.
 *
 * Rule: while the customer's latest order is still open (INQUIRY / CONFIRMED /
 * DELIVERED) we keep adding to it. Only once it's CLOSED (COMPLETED or
 * CANCELLED) does the next message begin a fresh order.
 *
 * @param {string} phoneNumber
 * @returns {Promise<import('mongoose').Document>}
 */
async function findOrCreateActiveOrder(phoneNumber) {
  const latest = await Order.findOne({ phoneNumber }).sort({ createdAt: -1 });

  if (latest && !CLOSED_STATUSES.includes(latest.status)) {
    return latest; // still open → continue the same conversation
  }

  // No order yet, or the last one is closed → start a new one.
  return createNewOrder(phoneNumber);
}

/**
 * Process one incoming customer message (already text — voice was transcribed
 * upstream). Returns the reply text to send back over WhatsApp.
 *
 * @param {object} args
 * @param {string} args.phoneNumber  - "whatsapp:+94..." or "+94..."
 * @param {string} args.text         - the message text
 * @param {'text'|'voice'} args.messageType
 * @returns {Promise<{reply: string, order: object}>}
 */
async function processIncomingMessage({ phoneNumber, text, messageType }) {
  const order = await findOrCreateActiveOrder(phoneNumber);

  // Is auto-reply on for this number? (Default true.)
  const autoReply = order.autoReplyEnabled !== false;

  // Record the inbound message + raise the "unread" flag for the seller.
  order.messages.push({ sender: 'customer', messageType: messageType || 'text', message: text });
  order.unreadCount = (order.unreadCount || 0) + 1;

  // Build the field snapshot + history for the AI.
  const currentFields = pickFields(order);
  const history = order.messages.map((m) => ({ sender: m.sender, message: m.message }));

  // Ask the AI to extract + decide intent + write a natural reply. We pass the
  // current status + returning-customer flag so it can behave appropriately
  // (greet returning customers warmly, answer follow-up questions after an
  // order is confirmed, etc.).
  const ai = await extractOrder({
    currentFields,
    history,
    latestMessage: text,
    status: order.status,
    isReturningCustomer: order.isReturningCustomer === true,
  });
  logger.info(`AI intent=${ai.intent} missing=[${ai.missingFields.join(',')}] status=${order.status}`);

  // Merge extracted fields (only non-empty so we never wipe a known value).
  // Happens in BOTH modes so the dashboard always reflects the latest details.
  for (const key of FIELD_KEYS) {
    const val = ai.fields[key];
    if (val && val.trim() !== '') order[key] = val.trim();
  }
  if (ai.summary) order.summary = ai.summary;

  // ── MANUAL MODE (auto-reply OFF): silent assist ───────────────────
  // Fields/summary already updated. Send nothing, change no status.
  if (!autoReply) {
    await order.save();
    logger.info('Auto-reply OFF → silent assist (no reply sent, status unchanged).');
    return { reply: null, autoReplyEnabled: false, order: order.toObject() };
  }

  // ── AUTO MODE: status transition (never downgrade) + reply ────────
  const stillMissing = ai.missingFields;
  let reply = ai.reply;

  if (ai.intent === 'CANCEL') {
    // Customers can cancel while INQUIRY/CONFIRMED/DELIVERED.
    order.status = ORDER_STATUS.CANCELLED;
  } else if (
    ai.intent === 'CONFIRM' &&
    stillMissing.length === 0 &&
    order.status === ORDER_STATUS.INQUIRY
  ) {
    // Only an open inquiry gets upgraded to CONFIRMED. Already-confirmed or
    // delivered orders keep their status while the customer keeps chatting.
    order.status = ORDER_STATUS.CONFIRMED;
  }
  // Otherwise: leave status as-is (follow-up questions don't change it).

  // Safety net if the AI returned an empty reply.
  if (!reply || reply.trim() === '') {
    reply = fallbackReply(order.status, stillMissing);
  }

  order.messages.push({ sender: 'bot', messageType: 'text', message: reply });
  await order.save();

  return { reply, autoReplyEnabled: true, order: order.toObject() };
}

/** Pull just the order-detail fields off a document. */
function pickFields(order) {
  const out = {};
  for (const key of FIELD_KEYS) out[key] = order[key] || '';
  return out;
}

/** A last-resort reply if the AI text was empty. */
function fallbackReply(status, missing) {
  if (status === ORDER_STATUS.CANCELLED) return 'Your order has been cancelled. ❌';
  if (status === ORDER_STATUS.CONFIRMED) return 'Your order is confirmed. ✅ Thank you!';
  if (missing && missing.length) {
    return 'To continue, please provide: ' + missing.join(', ') + '.';
  }
  return 'Please reply *CONFIRM* to place your order or *CANCEL* to cancel.';
}

module.exports = { processIncomingMessage, findOrCreateActiveOrder };

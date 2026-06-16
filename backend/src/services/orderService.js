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

const { Order, ORDER_STATUS } = require('../models/Order');
const { extractOrder } = require('../ai/orderExtractor');
const logger = require('../utils/logger');

// Fields the AI can fill on the order document.
const FIELD_KEYS = ['product', 'size', 'color', 'quantity', 'customerName', 'address', 'email'];

/**
 * Find the order this incoming message belongs to, or create a new inquiry.
 *
 * Rule:
 *   - If the customer's most recent order is still an INQUIRY → keep using it.
 *   - Otherwise (their last order was CONFIRMED or CANCELLED, or they have
 *     none) → start a NEW inquiry. EXCEPTION: if their last order is CONFIRMED
 *     and they're trying to CANCEL, we reuse that confirmed order so it can be
 *     cancelled (handled by passing it through when intent is CANCEL).
 *
 * @param {string} phoneNumber
 * @returns {Promise<import('mongoose').Document>}
 */
async function findOrCreateActiveOrder(phoneNumber) {
  // Most recent order for this number.
  const latest = await Order.findOne({ phoneNumber }).sort({ createdAt: -1 });

  if (latest && latest.status === ORDER_STATUS.INQUIRY) {
    return latest; // continue the in-progress inquiry
  }

  // If the latest order was just CONFIRMED, keep a handle to it so a quick
  // "cancel" right after confirming can still cancel THAT order.
  if (latest && latest.status === ORDER_STATUS.CONFIRMED) {
    // We attach it as a candidate; processMessage decides based on intent.
    latest._isRecentConfirmed = true;
    return latest;
  }

  // No usable order → create a fresh inquiry.
  return Order.create({ phoneNumber, status: ORDER_STATUS.INQUIRY });
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
  let order = await findOrCreateActiveOrder(phoneNumber);

  // If the most recent order was CONFIRMED and the customer is NOT cancelling,
  // we want a brand-new inquiry instead of mutating the confirmed one. We peek
  // at intent first via the AI, so log + AI happen before we finalize which
  // order to use. To keep it simple we run the AI against the chosen order's
  // current fields; if it turns out they're starting a new order after a
  // confirm, we create a fresh inquiry and re-run light handling.

  const wasRecentConfirmed = order._isRecentConfirmed === true;

  // Record the inbound message on whatever order we're currently considering.
  order.messages.push({ sender: 'customer', messageType: messageType || 'text', message: text });

  // Build the field snapshot + history for the AI.
  const currentFields = pickFields(order);
  const history = order.messages.map((m) => ({ sender: m.sender, message: m.message }));

  // Ask the AI to extract + decide intent + write the reply.
  const ai = await extractOrder({ currentFields, history, latestMessage: text });
  logger.info(`AI intent=${ai.intent} missing=[${ai.missingFields.join(',')}]`);

  // If the last order was already CONFIRMED and the customer is clearly placing
  // a NEW order (not cancelling), start a fresh inquiry so we don't overwrite
  // the confirmed one.
  if (wasRecentConfirmed && ai.intent !== 'CANCEL') {
    logger.info('Most recent order was CONFIRMED and customer is ordering again → new inquiry.');
    order = await Order.create({ phoneNumber, status: ORDER_STATUS.INQUIRY });
    order.messages.push({ sender: 'customer', messageType: messageType || 'text', message: text });
  }

  // Merge extracted fields into the order (only overwrite with non-empty values
  // so we never wipe a known value with a blank).
  for (const key of FIELD_KEYS) {
    const val = ai.fields[key];
    if (val && val.trim() !== '') order[key] = val.trim();
  }

  // Always refresh the dashboard summary.
  if (ai.summary) order.summary = ai.summary;

  // ── Authoritative status decision (business rules live here) ──────
  const stillMissing = ai.missingFields; // recomputed in code by the extractor
  let reply = ai.reply;

  if (ai.intent === 'CANCEL') {
    order.status = ORDER_STATUS.CANCELLED;
  } else if (ai.intent === 'CONFIRM' && stillMissing.length === 0) {
    order.status = ORDER_STATUS.CONFIRMED;
  } else {
    // Stay an inquiry while details are incomplete or not yet confirmed.
    order.status = ORDER_STATUS.INQUIRY;
  }

  // Safety net: if the AI somehow returned an empty reply, generate a minimal
  // fallback so the customer always gets a response.
  if (!reply || reply.trim() === '') {
    reply = fallbackReply(order.status, stillMissing);
  }

  // Log the bot's outgoing reply, then persist everything in one save.
  order.messages.push({ sender: 'bot', messageType: 'text', message: reply });
  await order.save();

  return { reply, order: order.toObject() };
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

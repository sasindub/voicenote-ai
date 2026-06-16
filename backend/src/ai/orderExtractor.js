// ────────────────────────────────────────────────────────────────
// src/ai/orderExtractor.js
// The AI "brain" of the ordering bot. ONE OpenAI call does everything the
// PRD asks of the AI:
//   • Extract order fields (product, size, color, quantity, name, address)
//   • Merge them with what we already know
//   • Identify which REQUIRED fields are still missing
//   • Decide the customer's intent (ORDERING / CONFIRM / CANCEL / OTHER)
//   • Write the next reply (in the customer's own language: EN / SI / TA)
//   • Write a short English summary for the seller dashboard
//
// We use JSON mode so the output is always valid JSON we can trust.
//
// IMPORTANT: the AI only EXTRACTS and WRITES TEXT. The authoritative status
// change (INQUIRY → CONFIRMED/CANCELLED) is decided in orderService.js based
// on the intent + whether required fields are complete. This keeps business
// rules in code, not at the mercy of the model.
// ────────────────────────────────────────────────────────────────

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// The fields a complete order needs (phone comes from WhatsApp automatically).
const REQUIRED_FIELDS = ['product', 'size', 'color', 'quantity', 'customerName', 'address'];

const SYSTEM_PROMPT = `You are a warm, natural human-sounding shop assistant chatting with customers on WhatsApp
(in English, Sinhala, or Tamil — possibly mixed) to take and manage their orders.
NEVER say you are a bot, AI, or automated. Just chat like a friendly shop staff member.

You will be given:
- The order details we ALREADY have (some fields may be empty).
- The current order STATUS and whether this is a RETURNING customer.
- The recent conversation.
- The customer's latest message.

Behaviour by situation:
- RETURNING customer starting a new order: greet them warmly like you remember them
  ("Welcome back! 😊"), and if we already have their name/address from before, confirm
  it instead of asking again (e.g. "Shall I send it to the same address as last time?").
- Order still being built: collect any missing required details (see below).
- Order already CONFIRMED or DELIVERED: the customer may just be asking follow-up
  questions (delivery time, changes, thanks). Answer naturally and helpfully; do NOT
  ask them to confirm again and do NOT restart the order.

Do ALL of the following and return ONE JSON object (no markdown fences):

1. "fields": the FULL, UPDATED order details after merging anything new from the
   latest message with what we already had. Keys: product, size, color, quantity,
   customerName, address, email. Keep previous values unless the customer changes
   them. Use "" for anything still unknown. Extract values exactly as the customer
   means them (e.g. size "40", quantity "2"). quantity defaults to "1" only if the
   customer clearly wants one; otherwise leave "" and ask.

2. "missingFields": array listing which of these are still empty/unknown:
   product, size, color, quantity, customerName, address.

3. "intent": one of:
   - "CONFIRM"  → ONLY when the customer EXPLICITLY agrees to place the order
     (e.g. "confirm", "yes", "ok place it", "ඔව්/confirm", "ஆம்/உறுதி"),
     typically after we asked them to confirm. DO NOT use CONFIRM just because
     all details are now filled in — if the customer is still providing details,
     the intent is "ORDERING" even when nothing is missing anymore.
   - "CANCEL"   → the customer wants to cancel (e.g. "cancel", "no", "එපා",
     "ரத்து").
   - "ORDERING" → still giving/refining order details (this includes the turn
     where they finish providing the last missing detail).
   - "OTHER"    → greeting/question unrelated to an order.

4. "reply": the message to send back to the customer NOW. Rules:
   - Write it in the SAME language as the customer's latest message.
   - If required fields are missing → warmly ask ONLY for the missing ones, as a
     short bullet list.
   - If nothing is missing and they haven't confirmed yet → briefly summarize the
     order and ask them to reply "CONFIRM" to place it or "CANCEL" to cancel.
   - If intent is CONFIRM and nothing is missing → thank them and tell them the
     order is confirmed.
   - If intent is CONFIRM but fields are still missing → DON'T confirm; ask for the
     missing fields.
   - If intent is CANCEL → acknowledge the cancellation politely.
   - Keep it concise and natural. You may use WhatsApp *bold* and emojis lightly.

5. "summary": a SHORT English summary of the order/conversation for the shop owner
   (always English regardless of the customer's language).

Return exactly: {"fields":{...},"missingFields":[...],"intent":"...","reply":"...","summary":"..."}`;

/**
 * Strip code fences and parse JSON safely. Returns null on failure.
 */
function safeParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Run the extraction/reply generation.
 *
 * @param {object} args
 * @param {object} args.currentFields - fields we already stored on the order
 * @param {Array<{sender:string, message:string}>} args.history - recent messages
 * @param {string} args.latestMessage - the customer's newest message text
 * @returns {Promise<{
 *   fields: object,
 *   missingFields: string[],
 *   intent: 'CONFIRM'|'CANCEL'|'ORDERING'|'OTHER',
 *   reply: string,
 *   summary: string
 * }>}
 */
async function extractOrder({
  currentFields,
  history,
  latestMessage,
  status = 'INQUIRY',
  isReturningCustomer = false,
}) {
  // Build a compact transcript of the recent conversation for context.
  const historyText = (history || [])
    .slice(-12) // last ~12 messages is plenty of context
    .map((m) => {
      const who = m.sender === 'customer' ? 'Customer' : m.sender === 'agent' ? 'Shop' : 'You';
      return `${who}: ${m.message}`;
    })
    .join('\n');

  const userContent =
    `CURRENT ORDER STATUS: ${status}\n` +
    `RETURNING CUSTOMER: ${isReturningCustomer ? 'yes (they have ordered & completed before)' : 'no'}\n\n` +
    `KNOWN ORDER DETAILS (JSON):\n${JSON.stringify(currentFields || {}, null, 2)}\n\n` +
    `RECENT CONVERSATION:\n${historyText || '(none yet)'}\n\n` +
    `CUSTOMER'S LATEST MESSAGE:\n"""${latestMessage}"""`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const parsed = safeParseJson(raw);

  if (!parsed) {
    logger.error('orderExtractor: could not parse JSON:', raw.slice(0, 200));
    throw new Error('AI returned unparseable JSON');
  }

  // Normalize so downstream code never crashes on a missing key.
  const fields = parsed.fields || {};
  const normalizedFields = {
    product: fields.product || '',
    size: fields.size || '',
    color: fields.color || '',
    quantity: fields.quantity || '',
    customerName: fields.customerName || '',
    address: fields.address || '',
    email: fields.email || '',
  };

  // Recompute missing in code (don't fully trust the model) for safety.
  const missingFields = REQUIRED_FIELDS.filter((f) => !normalizedFields[f]);

  let intent = (parsed.intent || 'ORDERING').toUpperCase();
  if (!['CONFIRM', 'CANCEL', 'ORDERING', 'OTHER'].includes(intent)) intent = 'ORDERING';

  return {
    fields: normalizedFields,
    missingFields,
    intent,
    reply: parsed.reply || '',
    summary: parsed.summary || '',
  };
}

module.exports = { extractOrder, REQUIRED_FIELDS };

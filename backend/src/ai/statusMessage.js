// ────────────────────────────────────────────────────────────────
// src/ai/statusMessage.js
// Composes a short, friendly WhatsApp update when the seller marks an order
// DELIVERED or COMPLETED — written in the SAME language the customer has been
// using. Falls back to a simple English message if the AI call fails.
// ────────────────────────────────────────────────────────────────

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Plain-English fallbacks if the AI is unavailable.
const FALLBACK = {
  DELIVERED: 'Good news! Your order is on the way. 🚚',
  COMPLETED: 'Your order is complete. Thank you for shopping with us! 🙏',
};

/**
 * @param {object} order - the order document (uses messages + fields for context)
 * @param {'DELIVERED'|'COMPLETED'} status
 * @returns {Promise<string>}
 */
async function composeStatusMessage(order, status) {
  const fallback = FALLBACK[status] || 'Update on your order.';

  try {
    // Give the model a little context so it matches the customer's language + tone.
    const recent = (order.messages || [])
      .slice(-6)
      .map((m) => `${m.sender === 'customer' ? 'Customer' : 'Shop'}: ${m.message}`)
      .join('\n');

    const intent =
      status === 'DELIVERED'
        ? 'their order has been dispatched / is on the way'
        : 'their order is now complete — thank them';

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You write a SINGLE short, warm WhatsApp message to a customer. Reply ONLY with the ' +
            'message text (no quotes, no labels). Write it in the SAME language the customer used ' +
            '(English, Sinhala, or Tamil). You may use one or two emojis. Do not mention being a bot.',
        },
        {
          role: 'user',
          content:
            `Recent conversation:\n${recent || '(none)'}\n\n` +
            `Product: ${order.product || 'their order'}\n` +
            `Write a message telling the customer that ${intent}.`,
        },
      ],
    });

    const text = (completion.choices?.[0]?.message?.content || '').trim();
    return text || fallback;
  } catch (err) {
    logger.error('composeStatusMessage failed, using fallback:', err?.message || err);
    return fallback;
  }
}

module.exports = { composeStatusMessage };

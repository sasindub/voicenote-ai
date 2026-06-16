// ────────────────────────────────────────────────────────────────
// src/whatsapp/sendMessage.js
// Sends a WhatsApp text reply to a customer via the Twilio REST API.
//
// WHY REST (not replying in the webhook): Twilio expects the webhook HTTP
// response within ~10–15s, but transcription + AI take longer. So we ack
// the webhook instantly and PUSH the reply later with this function.
// ────────────────────────────────────────────────────────────────

const { createTwilioClient } = require('./twilioClient');
const logger = require('../utils/logger');

const client = createTwilioClient();
const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

/**
 * Send a WhatsApp text message.
 * @param {string} to   - recipient "whatsapp:+94..."
 * @param {string} body - UTF-8 text (emojis / Sinhala / Tamil all fine)
 * @returns {Promise<object>} the Twilio message resource
 */
async function sendWhatsAppMessage(to, body) {
  // WhatsApp caps a message at ~4096 chars; trim defensively.
  const safeBody = body.length > 4000 ? body.slice(0, 3990) + '…' : body;

  const message = await client.messages.create({
    from: fromNumber,
    to,
    body: safeBody,
  });

  logger.info(`WhatsApp reply sent to ${to} (sid=${message.sid})`);
  return message;
}

module.exports = { sendWhatsAppMessage };

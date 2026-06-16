// ────────────────────────────────────────────────────────────────
// src/controllers/webhookController.js
// Handles the Twilio WhatsApp webhook (incoming customer messages).
//
// PATTERN: acknowledge Twilio instantly with empty TwiML (200), THEN do the
// slow work (download/transcribe/AI/reply) in the background and push the
// reply via the REST API. This prevents Twilio webhook timeouts.
// ────────────────────────────────────────────────────────────────

const { downloadMedia } = require('../whatsapp/downloadMedia');
const { transcribeAudio } = require('../ai/transcribe');
const { sendWhatsAppMessage } = require('../whatsapp/sendMessage');
const { processIncomingMessage } = require('../services/orderService');
const logger = require('../utils/logger');

// WhatsApp media cap is 16MB.
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

// Friendly multilingual fallbacks for edge cases.
const MSG_EMPTY_AUDIO = [
  "Sorry, I couldn't understand that audio clearly. Please try again.",
  'සමාවන්න, එම හඬ පැහැදිලිව තේරුම් ගත නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.',
  'மன்னிக்கவும், அந்த ஒலியை தெளிவாகப் புரிய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
].join('\n');

const MSG_ERROR = [
  'Something went wrong. Please try again in a moment.',
  'යම් දෝෂයක් ඇතිවිය. කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න.',
  'ஏதோ தவறு ஏற்பட்டது. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.',
].join('\n');

/**
 * Express handler for POST /webhook/whatsapp.
 */
function handleIncoming(req, res) {
  // Pull Twilio's fields.
  const from = req.body.From; // "whatsapp:+94..."
  const body = (req.body.Body || '').trim(); // text content (if any)
  const numMedia = parseInt(req.body.NumMedia || '0', 10);
  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0 || '';

  // 1) Ack immediately so Twilio is happy.
  res.set('Content-Type', 'text/xml');
  res.status(200).send('<Response></Response>');

  // 2) Process in the background (don't await — response already sent).
  processInBackground({ from, body, numMedia, mediaUrl, mediaType }).catch((err) =>
    logger.error('Unhandled error in webhook processing:', err)
  );
}

async function processInBackground({ from, body, numMedia, mediaUrl, mediaType }) {
  try {
    let text = body;
    let messageType = 'text';

    // If it's a voice note, download + transcribe it into `text`.
    const isAudio = numMedia > 0 && mediaType.toLowerCase().startsWith('audio');
    if (isAudio) {
      messageType = 'voice';
      logger.info(`Voice note from ${from} — downloading…`);
      const { buffer, contentType, sizeBytes } = await downloadMedia(mediaUrl);

      if (sizeBytes > MAX_AUDIO_BYTES) {
        await safeSend(from, 'That voice note is too large. Please send a shorter one.');
        return;
      }

      const { transcript } = await transcribeAudio(buffer, contentType);
      text = (transcript || '').trim();
      logger.info(`Transcript: ${text.slice(0, 120)}`);

      if (!text) {
        await safeSend(from, MSG_EMPTY_AUDIO);
        return;
      }
    }

    // Ignore truly empty messages (e.g. a sticker with no text).
    if (!text) {
      await safeSend(from, 'Please send a text or voice message to place an order. 🛍️');
      return;
    }

    // Run the ordering brain → get the reply to send back.
    const { reply, order } = await processIncomingMessage({
      phoneNumber: from,
      text,
      messageType,
    });

    logger.info(`Order ${order._id} status=${order.status}`);
    await safeSend(from, reply);
  } catch (err) {
    logger.error('Processing failed:', err?.message || err);
    if (err?.response?.data) logger.error('API detail:', err.response.data);
    await safeSend(from, MSG_ERROR);
  }
}

/** Send but never let a send failure crash the flow. */
async function safeSend(to, body) {
  try {
    await sendWhatsAppMessage(to, body);
  } catch (err) {
    logger.error('Failed to send WhatsApp reply:', err?.message || err);
  }
}

module.exports = { handleIncoming };

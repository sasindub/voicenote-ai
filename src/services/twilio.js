// ────────────────────────────────────────────────────────────────
// src/services/twilio.js
// Everything that talks to Twilio:
//   1. downloadMedia()  -> fetch the voice-note audio from Twilio's CDN.
//   2. sendWhatsApp()   -> send a text reply back to the user.
//
// WHY a REST client for sending (instead of replying in the webhook):
// Twilio expects the webhook HTTP response within ~10–15 seconds. Whisper
// + analysis can take longer than that. So we answer the webhook instantly
// (in server.js) and then PUSH the reply later using this REST client.
// ────────────────────────────────────────────────────────────────

const axios = require('axios');
const { createTwilioClient } = require('./twilioClient');

// For Basic Auth on the media URL, Twilio accepts EITHER
// "Account SID : Auth Token" OR "API Key SID : API Key Secret".
// Whatever you put in these two env vars works for the download.
const mediaAuthUser = (process.env.TWILIO_ACCOUNT_SID || '').trim();
const mediaAuthPass = (process.env.TWILIO_AUTH_TOKEN || '').trim();
const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

// Create the Twilio REST client once and reuse it.
// createTwilioClient() handles both classic (AC) and API-key (SK) styles.
const client = createTwilioClient();

/**
 * Download the audio file from Twilio's media URL.
 *
 * The media URL (MediaUrl0) is protected: you must authenticate with your
 * Account SID + Auth Token using HTTP Basic Auth. axios does this for us
 * via the `auth` option. We ask for an arraybuffer because audio is binary.
 *
 * @param {string} mediaUrl - the MediaUrl0 value from the webhook
 * @returns {Promise<{buffer: Buffer, contentType: string, sizeBytes: number}>}
 */
async function downloadMedia(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    auth: {
      username: mediaAuthUser,
      password: mediaAuthPass,
    },
    // Don't wait forever; fail loudly if Twilio is slow.
    timeout: 30000,
    // Follow the redirect Twilio issues to the real media CDN URL.
    maxRedirects: 5,
  });

  const buffer = Buffer.from(response.data);
  const contentType =
    response.headers['content-type'] || 'application/octet-stream';

  return {
    buffer,
    contentType,
    sizeBytes: buffer.length,
  };
}

/**
 * Send a WhatsApp text message back to a user via the Twilio REST API.
 *
 * @param {string} to   - recipient, e.g. "whatsapp:+9477..."
 * @param {string} body - the message text (UTF-8; emojis & Sinhala/Tamil OK)
 * @returns {Promise<object>} the Twilio message resource
 */
async function sendWhatsApp(to, body) {
  // WhatsApp has a ~4096 character limit per message. We trim defensively
  // so a very long reply never gets rejected by the API.
  const safeBody = body.length > 4000 ? body.slice(0, 3990) + '…' : body;

  return client.messages.create({
    from: fromNumber,
    to,
    body: safeBody,
  });
}

module.exports = {
  client,
  downloadMedia,
  sendWhatsApp,
};

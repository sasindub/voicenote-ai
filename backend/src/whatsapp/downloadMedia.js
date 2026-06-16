// ────────────────────────────────────────────────────────────────
// src/whatsapp/downloadMedia.js
// Downloads the audio file for a WhatsApp voice note from Twilio's CDN.
//
// The media URL (MediaUrl0) is protected. Twilio accepts Basic Auth with
// EITHER "Account SID : Auth Token" OR "API Key SID : Secret" — whatever
// you have in your two env vars works here.
// ────────────────────────────────────────────────────────────────

const axios = require('axios');

const mediaAuthUser = (process.env.TWILIO_ACCOUNT_SID || '').trim();
const mediaAuthPass = (process.env.TWILIO_AUTH_TOKEN || '').trim();

/**
 * Download a media URL and return the raw bytes + content type.
 * @param {string} mediaUrl - MediaUrl0 from the webhook
 * @returns {Promise<{buffer: Buffer, contentType: string, sizeBytes: number}>}
 */
async function downloadMedia(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer', // binary audio
    auth: { username: mediaAuthUser, password: mediaAuthPass },
    timeout: 30000,
    maxRedirects: 5, // Twilio redirects to the real CDN URL
  });

  const buffer = Buffer.from(response.data);
  return {
    buffer,
    contentType: response.headers['content-type'] || 'application/octet-stream',
    sizeBytes: buffer.length,
  };
}

module.exports = { downloadMedia };

// ────────────────────────────────────────────────────────────────
// src/server.js
// The Express app + the Twilio webhook.
//
// HIGH-LEVEL FLOW:
//   1. Twilio POSTs to /webhook/whatsapp when a WhatsApp message arrives.
//   2. We respond 200 IMMEDIATELY (empty TwiML) so Twilio doesn't time out.
//   3. AFTER responding, we do the slow work (download -> Whisper ->
//      analysis -> format) and PUSH the reply with the Twilio REST client.
//
// This "ack fast, process async" pattern is the key to a reliable webhook.
// ────────────────────────────────────────────────────────────────

// Load .env FIRST, before anything reads process.env.
require('dotenv').config();

const express = require('express');
const twilio = require('twilio');

// Our own modules
const { downloadMedia, sendWhatsApp } = require('./services/twilio');
const { transcribeAudio } = require('./services/transcribe');
const { analyzeTranscript } = require('./services/analyze');
const { isUnderLimit, logUsage } = require('./db/usage');
const {
  buildReply,
  quotaMessage,
  MSG_NOT_AUDIO,
  MSG_EMPTY_TRANSCRIPT,
  MSG_TOO_LONG,
  MSG_GENERIC_ERROR,
} = require('./utils/formatReply');

const app = express();

// ── Config from env ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
// Daily free limit. Falls back to the old FREE_MONTHLY_LIMIT name if set,
// so nothing breaks; default is 100 notes per number per day.
const FREE_DAILY_LIMIT = parseInt(
  process.env.FREE_DAILY_LIMIT || process.env.FREE_MONTHLY_LIMIT || '100',
  10
);
const VALIDATE_SIGNATURE =
  String(process.env.VALIDATE_TWILIO_SIGNATURE).toLowerCase() === 'true';
// WhatsApp's media cap is 16MB. We reject anything bigger as "too long".
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

// Twilio posts data as application/x-www-form-urlencoded.
// This middleware parses that into req.body.
// extended:true lets us handle nested values; not strictly required here.
app.use(express.urlencoded({ extended: true }));

// ── Optional Twilio signature validation ──────────────────────────
// When VALIDATE_TWILIO_SIGNATURE=true, twilio.webhook() rejects any
// request that isn't genuinely signed by Twilio. We keep it toggleable
// so you can test locally with curl (set it to false).
const webhookMiddleware = VALIDATE_SIGNATURE
  ? twilio.webhook({ validate: true })
  : (req, res, next) => next(); // no-op passthrough for local testing

// ── Health check (handy for Railway/Render uptime + your own tests) ─
app.get('/', (req, res) => {
  res.status(200).send('VoiceNote AI is running ✅');
});

// ── The Twilio WhatsApp webhook ───────────────────────────────────
app.post('/webhook/whatsapp', webhookMiddleware, (req, res) => {
  // Pull the fields Twilio sends. See:
  // https://www.twilio.com/docs/messaging/guides/webhook-request
  const from = req.body.From; // e.g. "whatsapp:+9477..."
  const numMedia = parseInt(req.body.NumMedia || '0', 10);
  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0 || '';

  // STEP 1 — acknowledge the webhook instantly with empty TwiML.
  // Replying <Response></Response> means "no immediate reply"; we'll push
  // the real reply later via the REST API. This avoids Twilio timeouts.
  res.set('Content-Type', 'text/xml');
  res.status(200).send('<Response></Response>');

  // STEP 2 — do the heavy lifting asynchronously (fire-and-forget).
  // We intentionally do NOT await this; the HTTP response already went out.
  processMessage({ from, numMedia, mediaUrl, mediaType }).catch((err) => {
    // Last-resort safety net so an unexpected throw never crashes the app.
    console.error('[FATAL] Unhandled error in processMessage:', err);
  });
});

/**
 * The full pipeline for one incoming message. Runs AFTER we've already
 * answered Twilio's webhook. Every external call is wrapped in try/catch
 * and we always try to send the user *some* reply.
 */
async function processMessage({ from, numMedia, mediaUrl, mediaType }) {
  console.log(`\n[IN] message from ${from} | media=${numMedia} | type=${mediaType}`);

  // ── Case A: not a voice note ────────────────────────────────────
  // We need NumMedia > 0 AND the media to be audio. Anything else (text,
  // images, stickers) gets the friendly "send a voice note" message.
  const isAudio = numMedia > 0 && mediaType.toLowerCase().startsWith('audio');
  if (!isAudio) {
    console.log('[INFO] Not an audio message — sending instructions.');
    await safeSend(from, MSG_NOT_AUDIO);
    return;
  }

  // ── Case B: quota check BEFORE doing any paid API work ──────────
  if (!isUnderLimit(from, FREE_DAILY_LIMIT)) {
    console.log(`[QUOTA] ${from} is over the daily limit of ${FREE_DAILY_LIMIT}.`);
    await safeSend(from, quotaMessage(FREE_DAILY_LIMIT));
    return;
  }

  // From here we may log a usage row. Track details for the log.
  let language = null;
  let charCount = 0;

  try {
    // ── 1. Download the audio from Twilio ─────────────────────────
    console.log('[STEP] Downloading media…');
    const { buffer, contentType, sizeBytes } = await downloadMedia(mediaUrl);
    console.log(`[OK] Downloaded ${sizeBytes} bytes (${contentType}).`);

    // Size guard: WhatsApp caps media at 16MB. If it's bigger, it's almost
    // certainly a long note we don't process on the free tier.
    if (sizeBytes > MAX_AUDIO_BYTES) {
      console.log('[INFO] Audio too large — rejecting as too long.');
      await safeSend(from, MSG_TOO_LONG);
      logUsage({ fromNumber: from, success: false });
      return;
    }

    // ── 2. Transcribe with Whisper (auto-detect + Sinhala correction) ──
    console.log('[STEP] Transcribing with Whisper…');
    const {
      transcript,
      language: whisperLanguage,
      corrected,
    } = await transcribeAudio(buffer, contentType);

    if (!transcript || transcript.trim().length === 0) {
      console.log('[INFO] Empty transcript — asking user to re-record.');
      await safeSend(from, MSG_EMPTY_TRANSCRIPT);
      logUsage({ fromNumber: from, success: false });
      return;
    }
    charCount = transcript.length;
    console.log(
      `[OK] Transcript (${charCount} chars, lang=${whisperLanguage}` +
        `${corrected ? ', Sinhala-corrected' : ''}): ${transcript.slice(0, 120)}…`
    );

    // ── 3. Analyze with the LLM (strict JSON) ─────────────────────
    // We pass Whisper's detected language as a hint so the LLM stays in the
    // right script (helps lock in Sinhala instead of drifting to English).
    console.log('[STEP] Analyzing transcript…');
    const analysis = await analyzeTranscript(transcript, whisperLanguage);
    language = analysis.detected_language;
    console.log(`[OK] Analysis done. Language: ${language}`);

    // ── 4. Format & send the reply ────────────────────────────────
    const reply = buildReply(analysis);
    console.log('[STEP] Sending reply to user…');
    await sendWhatsApp(from, reply);
    console.log('[OK] Reply sent.');

    // ── 5. Log success (this counts toward the monthly quota) ─────
    logUsage({
      fromNumber: from,
      language,
      charCount,
      success: true,
    });
  } catch (err) {
    // One catch-all for the pipeline. We log details and tell the user.
    console.error('[ERROR] Pipeline failed:', err?.message || err);
    if (err?.response?.data) {
      console.error('[ERROR] API detail:', err.response.data);
    }
    await safeSend(from, MSG_GENERIC_ERROR);
    logUsage({ fromNumber: from, language, charCount, success: false });
  }
}

/**
 * Send a WhatsApp message but never let a send failure crash the pipeline.
 * (If even the error message can't be delivered, we just log it.)
 */
async function safeSend(to, body) {
  try {
    await sendWhatsApp(to, body);
  } catch (err) {
    console.error('[ERROR] Failed to send WhatsApp message:', err?.message || err);
  }
}

// ── Start the server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 VoiceNote AI listening on http://localhost:${PORT}`);
  console.log(`   Webhook path: POST /webhook/whatsapp`);
  console.log(`   Signature validation: ${VALIDATE_SIGNATURE ? 'ON' : 'OFF (local mode)'}`);
  console.log(`   Free daily limit: ${FREE_DAILY_LIMIT} notes/number/day`);
});

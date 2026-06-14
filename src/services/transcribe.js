// ────────────────────────────────────────────────────────────────
// src/services/transcribe.js
// Speech-to-text using OpenAI Whisper (model "whisper-1").
//
// THE SINHALA PROBLEM (and how we fix it):
// Sinhala is a low-resource language for Whisper. When left to fully
// auto-detect, Whisper often HEARS the Sinhala correctly but WRITES it in
// the wrong script (Telugu, Tamil, Hindi, Kannada, Malayalam) because those
// languages are phonetically similar and Whisper has far more training data
// for them. The result is gibberish in the wrong alphabet.
//
// OUR FIX — "detect, then correct":
//   1. First pass: auto-detect (verbose_json gives us the detected language).
//   2. If Whisper detected one of OUR supported languages (English / Sinhala
//      / Tamil), great — use it. This preserves auto-detect + code-switching.
//   3. If it detected ANYTHING ELSE (telugu, hindi, etc.), our users don't
//      speak those — it's almost certainly mis-identified Sinhala. So we
//      re-run Whisper, this time FORCING Sinhala ("si"), which makes it write
//      proper Sinhala script (අ ආ ඉ ...).
//
// You can change the fallback language / supported set via env vars.
// ────────────────────────────────────────────────────────────────

const { OpenAI } = require('openai');
const { toFile } = require('openai/uploads');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Languages your users actually speak. If Whisper auto-detects something
// OUTSIDE this set, we treat it as a mis-detection and force the fallback.
// Whisper's verbose_json returns full English names like "english".
const SUPPORTED_LANGUAGES = (process.env.WHISPER_SUPPORTED_LANGUAGES ||
  'english,sinhala,tamil')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// When auto-detect lands outside the supported set, retry forcing THIS
// language code. "si" = Sinhala (the usual culprit). ISO-639-1 codes.
const FALLBACK_LANGUAGE_CODE = (process.env.WHISPER_FALLBACK_LANGUAGE || 'si').trim();

/**
 * Run a single Whisper call.
 * @param {object} file - file-like object from toFile()
 * @param {string|undefined} languageCode - ISO code to FORCE, or undefined to auto-detect
 * @returns {Promise<{text: string, language: string}>}
 */
async function runWhisper(file, languageCode) {
  // verbose_json gives us BOTH the text and the detected/forced language,
  // so we can decide whether a retry is needed.
  const params = {
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
  };
  // Only set `language` when we want to FORCE one (the corrective 2nd pass).
  if (languageCode) params.language = languageCode;

  const res = await openai.audio.transcriptions.create(params);

  return {
    text: (res?.text || '').toString().trim(),
    // e.g. "english", "sinhala", "telugu" — already lowercase from the API.
    language: (res?.language || '').toString().trim().toLowerCase(),
  };
}

/**
 * Transcribe an audio buffer to text, with Sinhala mis-detection correction.
 *
 * NOTE: re-running Whisper on a fallback costs a second API call, but only
 * happens when the first pass detected an unsupported language — i.e. only
 * for the Sinhala-confusion case, not for normal English/Tamil notes.
 *
 * @param {Buffer} audioBuffer
 * @param {string} contentType - e.g. "audio/ogg"
 * @returns {Promise<{transcript: string, language: string, corrected: boolean}>}
 */
async function transcribeAudio(audioBuffer, contentType) {
  const ext = extensionFromContentType(contentType);

  // The OpenAI SDK needs a file-like object. We must build a FRESH one for
  // each call because the stream gets consumed once it's uploaded.
  const makeFile = () =>
    toFile(audioBuffer, `voice-note.${ext}`, { type: contentType });

  // --- Pass 1: auto-detect -----------------------------------------
  const first = await runWhisper(await makeFile(), undefined);
  console.log(`[WHISPER] auto-detected language: "${first.language}"`);

  // If it detected a language we support, trust it (handles EN/SI/TA +
  // most code-switching, since Whisper reports the DOMINANT language).
  if (SUPPORTED_LANGUAGES.includes(first.language)) {
    return {
      transcript: first.text,
      language: first.language,
      corrected: false,
    };
  }

  // --- Pass 2: corrective retry forcing Sinhala --------------------
  // Reaching here means Whisper guessed e.g. "telugu"/"hindi" — languages our
  // users don't speak — so it almost certainly mis-scripted Sinhala speech.
  console.log(
    `[WHISPER] "${first.language}" is outside supported set ` +
      `[${SUPPORTED_LANGUAGES.join(', ')}]; retrying forced as "${FALLBACK_LANGUAGE_CODE}".`
  );

  try {
    const second = await runWhisper(await makeFile(), FALLBACK_LANGUAGE_CODE);
    // Use the forced-Sinhala result if it actually produced text.
    if (second.text && second.text.length > 0) {
      return {
        transcript: second.text,
        language: second.language || 'sinhala',
        corrected: true,
      };
    }
  } catch (err) {
    console.error('[WHISPER] forced-Sinhala retry failed:', err?.message || err);
    // fall through to returning the first pass below
  }

  // If the retry produced nothing, return the original (better than empty).
  return {
    transcript: first.text,
    language: first.language || 'unknown',
    corrected: false,
  };
}

/**
 * Map a mime type to a file extension Whisper understands.
 * Falls back to "ogg" because WhatsApp voice notes are typically OGG/Opus.
 */
function extensionFromContentType(contentType = '') {
  const map = {
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/amr': 'amr',
  };
  const key = contentType.split(';')[0].trim().toLowerCase();
  return map[key] || 'ogg';
}

module.exports = { transcribeAudio };

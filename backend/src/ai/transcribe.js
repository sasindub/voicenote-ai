// ────────────────────────────────────────────────────────────────
// src/ai/transcribe.js
// Speech-to-text using OpenAI Whisper ("whisper-1").
//
// THE SINHALA PROBLEM: Sinhala is low-resource for Whisper. On full
// auto-detect it often HEARS Sinhala correctly but WRITES it in the wrong
// script (Telugu/Hindi/Tamil). FIX = "detect, then correct":
//   1. Auto-detect first.
//   2. If detected language is one we support (EN/SI/TA) → keep it.
//   3. If it's anything else → our users don't speak it → almost certainly
//      mis-identified Sinhala → re-run forcing Sinhala ("si").
// ────────────────────────────────────────────────────────────────

const { OpenAI } = require('openai');
const { toFile } = require('openai/uploads');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUPPORTED_LANGUAGES = (process.env.WHISPER_SUPPORTED_LANGUAGES ||
  'english,sinhala,tamil')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const FALLBACK_LANGUAGE_CODE = (process.env.WHISPER_FALLBACK_LANGUAGE || 'si').trim();

async function runWhisper(file, languageCode) {
  const params = { file, model: 'whisper-1', response_format: 'verbose_json' };
  if (languageCode) params.language = languageCode; // force only on retry
  const res = await openai.audio.transcriptions.create(params);
  return {
    text: (res?.text || '').toString().trim(),
    language: (res?.language || '').toString().trim().toLowerCase(),
  };
}

/**
 * Transcribe an audio buffer to text, correcting Sinhala mis-detection.
 * @returns {Promise<{transcript: string, language: string}>}
 */
async function transcribeAudio(audioBuffer, contentType) {
  const ext = extensionFromContentType(contentType);
  const makeFile = () =>
    toFile(audioBuffer, `voice-note.${ext}`, { type: contentType });

  // Pass 1: auto-detect.
  const first = await runWhisper(await makeFile(), undefined);
  logger.info(`Whisper auto-detected: "${first.language}"`);

  if (SUPPORTED_LANGUAGES.includes(first.language)) {
    return { transcript: first.text, language: first.language };
  }

  // Pass 2: corrective retry forcing Sinhala.
  logger.warn(
    `"${first.language}" outside [${SUPPORTED_LANGUAGES.join(', ')}]; retrying as "${FALLBACK_LANGUAGE_CODE}"`
  );
  try {
    const second = await runWhisper(await makeFile(), FALLBACK_LANGUAGE_CODE);
    if (second.text) return { transcript: second.text, language: second.language || 'sinhala' };
  } catch (err) {
    logger.error('Forced-Sinhala retry failed:', err?.message || err);
  }

  return { transcript: first.text, language: first.language || 'unknown' };
}

function extensionFromContentType(contentType = '') {
  const map = {
    'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3', 'audio/mp4': 'mp4', 'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/webm': 'webm', 'audio/amr': 'amr',
  };
  const key = contentType.split(';')[0].trim().toLowerCase();
  return map[key] || 'ogg';
}

module.exports = { transcribeAudio };

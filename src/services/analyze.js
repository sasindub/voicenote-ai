// ────────────────────────────────────────────────────────────────
// src/services/analyze.js
// Analysis step: take the raw transcript and turn it into structured,
// useful output (cleaned text, general idea, summary, key points).
//
// IMPORTANT DESIGN NOTE:
// The original spec mentioned Claude. Because you supplied an OpenAI key
// (and no Anthropic key), this build uses OpenAI's chat completions with
// JSON mode instead. The behaviour/contract is identical: we send the
// transcript and get back STRICT JSON with a fixed set of keys.
//
// LANGUAGE RULE (critical): every generated value must stay in the SAME
// language as the voice note. If the user spoke Sinhala, the summary and
// key points come back in Sinhala — never translated to English.
// ────────────────────────────────────────────────────────────────

const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini';

// The system prompt defines the assistant's job and the strict output shape.
// We are very explicit about the language rule and the JSON keys so the
// model can't drift.
const SYSTEM_PROMPT = `You are a multilingual assistant that processes transcribed voice notes.
The transcript may be in English, Sinhala (සිංහල), Tamil (தமிழ்), or a mix of these (code-switching).

Your job: analyze the transcript and return a JSON object ONLY (no prose, no markdown fences).

The JSON object MUST have EXACTLY these keys:
- "detected_language": a short label of the dominant language, e.g. "English", "Sinhala", "Tamil", or "Mixed (Sinhala + English)".
- "transcript_cleaned": the transcript with fixed punctuation/capitalization and obvious filler removed, but meaning unchanged.
- "general_idea": one or two sentences capturing what the note is broadly about.
- "summary": a concise paragraph summarizing the content.
- "key_points": an array of short strings — the key points and any action items. Use an empty array if there are none.

ABSOLUTE RULE ABOUT LANGUAGE:
All text values (transcript_cleaned, general_idea, summary, and every key_points item)
MUST be written in the SAME language as the voice note. If the note is in Sinhala,
write them in Sinhala. If Tamil, in Tamil. If the note mixes languages, keep the mix.
NEVER translate the content into English unless the note itself was in English.
Only "detected_language" is an English label.

Return valid UTF-8 JSON. Do not wrap it in code fences.`;

/**
 * Safely parse a JSON string that *might* be wrapped in ```json fences
 * or contain stray text around it. Returns null on failure.
 */
function safeParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences if the model added them.
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  }

  // First attempt: parse as-is.
  try {
    return JSON.parse(text);
  } catch (_) {
    // Fallback: grab the substring between the first "{" and the last "}".
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Analyze a transcript and return the structured object.
 *
 * @param {string} transcript - raw text from Whisper
 * @param {string} [languageHint] - Whisper's detected language (e.g. "sinhala"),
 *        used to keep the model writing in the correct script.
 * @returns {Promise<{
 *   detected_language: string,
 *   transcript_cleaned: string,
 *   general_idea: string,
 *   summary: string,
 *   key_points: string[]
 * }>}
 */
async function analyzeTranscript(transcript, languageHint) {
  // If Whisper told us the language, pass it as a strong hint so the model
  // doesn't translate Sinhala/Tamil into English by mistake.
  const hintLine =
    languageHint && languageHint !== 'unknown'
      ? `\n\nThe speech was detected as: ${languageHint}. Write ALL output values in ${languageHint} (same script), unless the transcript is clearly mixed.`
      : '';

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    // JSON mode forces the model to return syntactically valid JSON.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Here is the transcript of a voice note. Analyze it and return the JSON described.${hintLine}\n\nTRANSCRIPT:\n"""${transcript}"""`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const parsed = safeParseJson(raw);

  // If parsing failed completely, throw so the caller can send the
  // "couldn't understand" fallback and log a failure.
  if (!parsed) {
    throw new Error('Analysis returned unparseable JSON: ' + raw.slice(0, 200));
  }

  // Normalize the shape so downstream code never crashes on a missing field.
  return {
    detected_language: parsed.detected_language || 'Unknown',
    transcript_cleaned: parsed.transcript_cleaned || transcript,
    general_idea: parsed.general_idea || '',
    summary: parsed.summary || '',
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
  };
}

module.exports = { analyzeTranscript, safeParseJson };

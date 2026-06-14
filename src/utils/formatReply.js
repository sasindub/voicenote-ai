// ────────────────────────────────────────────────────────────────
// src/utils/formatReply.js
// Builds the final WhatsApp message text from the analysis object.
//
// WhatsApp formatting cheatsheet:
//   *bold*      _italic_      ~strike~      ```mono```
// We use *bold* for section headers and "•" bullets for key points.
// Everything is plain UTF-8 so Sinhala/Tamil render correctly.
// ────────────────────────────────────────────────────────────────

/**
 * Build the rich reply for a successfully processed voice note.
 *
 * @param {object} analysis - the object from analyzeTranscript()
 * @returns {string} ready-to-send WhatsApp message
 */
function buildReply(analysis) {
  const {
    detected_language,
    transcript_cleaned,
    general_idea,
    summary,
    key_points,
  } = analysis;

  const lines = [];

  // Small header showing the detected language so the user trusts it.
  lines.push(`🌐 *Language:* ${detected_language || 'Unknown'}`);
  lines.push('');

  // 📝 Transcript
  lines.push('📝 *Transcript*');
  lines.push(transcript_cleaned || '—');
  lines.push('');

  // 💡 General Idea
  lines.push('💡 *General Idea*');
  lines.push(general_idea || '—');
  lines.push('');

  // 📋 Summary
  lines.push('📋 *Summary*');
  lines.push(summary || '—');

  // ✅ Key Points (only if we actually have any)
  if (Array.isArray(key_points) && key_points.length > 0) {
    lines.push('');
    lines.push('✅ *Key Points*');
    for (const point of key_points) {
      lines.push(`• ${point}`);
    }
  }

  return lines.join('\n');
}

// ── Friendly fixed messages, offered in EN + SI + TA together ──────
// We can't know the language before transcribing, so for non-audio and
// quota messages we show all three so every user understands.

const MSG_NOT_AUDIO = [
  '👋 *Send me a voice note* and I’ll transcribe and summarize it for you.',
  '',
  '🇬🇧 Send a voice note and I will transcribe & summarize it.',
  '🇱🇰 කරුණාකර හඬ පණිවිඩයක් (voice note) එවන්න — මම එය පිටපත් කර සාරාංශ කරන්නම්.',
  '🇱🇰 ஒரு குரல் குறிப்பை (voice note) அனுப்புங்கள் — நான் அதை எழுத்துருவாக்கி சுருக்கித் தருகிறேன்.',
].join('\n');

const MSG_EMPTY_TRANSCRIPT = [
  'Sorry, I couldn’t understand that audio clearly. Please try recording again.',
  '',
  'සමාවන්න, එම හඬ පැහැදිලිව තේරුම් ගත නොහැකි විය. කරුණාකර නැවත පටිගත කරන්න.',
  'மன்னிக்கவும், அந்த ஒலியை தெளிவாகப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் பதிவு செய்யவும்.',
].join('\n');

const MSG_TOO_LONG = [
  'This voice note is too long for the free tier. Please send a shorter note (under 10 minutes).',
  '',
  'මෙම හඬ පණිවිඩය නොමිලේ සැලැස්මට වඩා දිගයි. කරුණාකර කෙටි පණිවිඩයක් (මිනිත්තු 10 ට අඩු) එවන්න.',
  'இந்தக் குரல் குறிப்பு இலவசத் திட்டத்திற்கு மிக நீளமானது. தயவுசெய்து குறுகிய குறிப்பை (10 நிமிடங்களுக்குள்) அனுப்பவும்.',
].join('\n');

const MSG_GENERIC_ERROR = [
  'Something went wrong while processing your voice note. Please try again in a moment.',
  '',
  'ඔබගේ හඬ පණිවිඩය සැකසීමේදී යම් දෝෂයක් ඇතිවිය. කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න.',
  'உங்கள் குரல் குறிப்பைச் செயலாக்கும்போது ஏதோ தவறு ஏற்பட்டது. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.',
].join('\n');

/**
 * Build the "you hit your free limit" message.
 * @param {number} limit
 */
function quotaMessage(limit) {
  return [
    `You’ve reached your free limit of ${limit} notes today. Please try again tomorrow, or upgrade for unlimited.`,
    '',
    `ඔබ අද දින නොමිලේ ලබාදෙන හඬ පණිවිඩ ${limit} සීමාවට ළඟා වී ඇත. කරුණාකර හෙට නැවත උත්සාහ කරන්න, නැතහොත් අසීමිත සඳහා උත්ශ්‍රේණි කරන්න.`,
    `இன்றைய இலவச ${limit} குறிப்புகள் வரம்பை அடைந்துவிட்டீர்கள். நாளை மீண்டும் முயற்சிக்கவும், அல்லது வரம்பற்றதற்கு மேம்படுத்துங்கள்.`,
  ].join('\n');
}

module.exports = {
  buildReply,
  quotaMessage,
  MSG_NOT_AUDIO,
  MSG_EMPTY_TRANSCRIPT,
  MSG_TOO_LONG,
  MSG_GENERIC_ERROR,
};

// ────────────────────────────────────────────────────────────────
// src/scripts/test-send.js
// A standalone script to verify your Twilio WhatsApp setup works —
// BEFORE you bother with voice notes / Whisper / the webhook.
//
// It does exactly what the Twilio quickstart does: create one outbound
// WhatsApp message using your Account SID + Auth Token.
//
// HOW TO RUN:
//   1. Fill TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env
//   2. From your phone, JOIN the sandbox first (send "join <code>" to the
//      sandbox number) — Twilio only lets you message numbers that joined.
//   3. Run:  node src/scripts/test-send.js whatsapp:+9477XXXXXXX
//      (pass YOUR phone number, including the whatsapp: prefix)
//
// If it prints "✅ Sent! SID: SM..." and the message arrives on your
// phone, your Twilio credentials + sandbox are working correctly.
// ────────────────────────────────────────────────────────────────

require('dotenv').config();
const { createTwilioClient } = require('../whatsapp/twilioClient');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"

// The recipient is passed on the command line. Default to a placeholder
// so the script gives a helpful error instead of sending to nowhere.
const to = process.argv[2];

async function main() {
  // --- Friendly validation so beginners get clear messages ---------
  if (!accountSid || !authToken) {
    console.error('❌ Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in .env');
    process.exit(1);
  }
  if (!to) {
    console.error('❌ Please pass your WhatsApp number, e.g.:');
    console.error('   node src/scripts/test-send.js whatsapp:+9477XXXXXXX');
    process.exit(1);
  }

  // Builds the client correctly whether you use AC+Token or SK API keys.
  const client = createTwilioClient();

  try {
    const message = await client.messages.create({
      from,
      to,
      body: '✅ VoiceNote AI test message. Your Twilio WhatsApp setup works! 🎉',
    });
    console.log('✅ Sent! SID:', message.sid);
    console.log('   Status:', message.status);
    console.log('   Check your phone for the message.');
  } catch (err) {
    console.error('❌ Twilio send failed:', err.message);
    // Twilio's most common sandbox errors, explained:
    if (err.code === 63007 || err.code === 21910) {
      console.error('   → The "from" number may be wrong. For the sandbox it');
      console.error('     must be exactly:  whatsapp:+14155238886');
    }
    if (err.code === 63016 || err.code === 21608) {
      console.error('   → The recipient hasn’t JOINED the sandbox. On that phone,');
      console.error('     send "join <your-code>" to +14155238886 first.');
    }
    if (err.code === 20003) {
      console.error('   → Authentication failed: check your SID + Auth Token.');
    }
    process.exit(1);
  }
}

main();

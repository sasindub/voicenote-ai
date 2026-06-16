// ────────────────────────────────────────────────────────────────
// src/whatsapp/twilioClient.js
// Creates ONE Twilio REST client, supporting BOTH credential styles:
//   1. CLASSIC : Account SID ("AC...") + Auth Token
//   2. API KEY : API Key SID ("SK...") + Secret + your Account SID ("AC...")
//
// If you accidentally put an SK key in the Account SID slot with classic
// auth, Twilio throws "accountSid must start with AC". This helper detects
// which style you have and builds the client correctly.
// ────────────────────────────────────────────────────────────────

const twilio = require('twilio');

/**
 * Build a configured Twilio client from environment variables.
 * @returns {import('twilio').Twilio}
 */
function createTwilioClient() {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const secret = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const accountSidForApiKey = (process.env.TWILIO_ACCOUNT_SID_AC || '').trim();

  if (!sid || !secret) {
    throw new Error(
      'Twilio credentials missing: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env'
    );
  }

  // API Key style (SID starts with SK) — needs the Account SID separately.
  if (sid.startsWith('SK')) {
    if (!accountSidForApiKey.startsWith('AC')) {
      throw new Error(
        'Using a Twilio API Key (SK...). Also set TWILIO_ACCOUNT_SID_AC=AC... in .env ' +
          '(your Account SID from the Twilio Console dashboard).'
      );
    }
    return twilio(sid, secret, { accountSid: accountSidForApiKey });
  }

  // Classic style (SID starts with AC).
  if (sid.startsWith('AC')) {
    return twilio(sid, secret);
  }

  throw new Error(
    `TWILIO_ACCOUNT_SID looks wrong ("${sid.slice(0, 4)}..."). ` +
      'It must start with "AC" (Account SID) or "SK" (API Key SID).'
  );
}

module.exports = { createTwilioClient };

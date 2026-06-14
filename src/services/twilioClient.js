// ────────────────────────────────────────────────────────────────
// src/services/twilioClient.js
// Creates ONE Twilio REST client, supporting BOTH credential styles.
//
// Twilio gives you two ways to authenticate:
//
//   1. CLASSIC  (simplest):
//        Account SID  (starts with "AC...")  +  Auth Token
//        -> twilio(accountSid, authToken)
//
//   2. API KEY  (more secure / production-preferred):
//        API Key SID  (starts with "SK...")  +  API Key Secret
//        ...but you ALSO need your Account SID ("AC...") passed separately:
//        -> twilio(apiKeySid, apiKeySecret, { accountSid })
//
// The classic style fails with:
//   "accountSid must start with AC ..."
// if you accidentally put an SK key in the Account SID slot. This helper
// detects which style you have and builds the client the right way.
// ────────────────────────────────────────────────────────────────

const twilio = require('twilio');

/**
 * Build a configured Twilio client based on what's in the environment.
 * Throws a clear, beginner-friendly error if something's missing/mismatched.
 *
 * Env vars it reads:
 *   TWILIO_ACCOUNT_SID   - either "AC..." (classic) or "SK..." (API key sid)
 *   TWILIO_AUTH_TOKEN    - the Auth Token (classic) OR the API Key Secret
 *   TWILIO_ACCOUNT_SID_AC- ONLY needed in API-key mode: your real "AC..." SID
 *
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

  // --- API Key style (SID starts with SK) ---------------------------
  if (sid.startsWith('SK')) {
    if (!accountSidForApiKey.startsWith('AC')) {
      throw new Error(
        'You are using a Twilio API Key (SK...). API keys also need your ' +
          'Account SID. Add it to .env as:\n' +
          '   TWILIO_ACCOUNT_SID_AC=ACxxxxxxxxxxxxxxxx\n' +
          '(find the AC... value on the Twilio Console dashboard).'
      );
    }
    // Here TWILIO_AUTH_TOKEN is actually the API Key Secret.
    return twilio(sid, secret, { accountSid: accountSidForApiKey });
  }

  // --- Classic style (SID starts with AC) ---------------------------
  if (sid.startsWith('AC')) {
    return twilio(sid, secret);
  }

  // --- Anything else is a typo -------------------------------------
  throw new Error(
    `TWILIO_ACCOUNT_SID looks wrong (got "${sid.slice(0, 4)}..."). It must ` +
      'start with "AC" (Account SID) or "SK" (API Key SID).'
  );
}

/**
 * The Account SID Twilio needs for things like media-URL Basic Auth.
 * In classic mode it's TWILIO_ACCOUNT_SID; in API-key mode it's the
 * separate AC value (TWILIO_ACCOUNT_SID_AC).
 */
function getAccountSid() {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  if (sid.startsWith('AC')) return sid;
  return (process.env.TWILIO_ACCOUNT_SID_AC || '').trim();
}

module.exports = { createTwilioClient, getAccountSid };

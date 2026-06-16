// ────────────────────────────────────────────────────────────────
// src/middleware/twilioSignature.js
// Optionally verifies that webhook requests genuinely come from Twilio.
//
// Toggle with VALIDATE_TWILIO_SIGNATURE in .env:
//   false (default) → skip validation (handy for local curl tests)
//   true            → use Twilio's official validator (use in production)
// ────────────────────────────────────────────────────────────────

const twilio = require('twilio');

const VALIDATE = String(process.env.VALIDATE_TWILIO_SIGNATURE).toLowerCase() === 'true';

const twilioSignature = VALIDATE
  ? twilio.webhook({ validate: true })
  : (req, res, next) => next(); // no-op passthrough

module.exports = { twilioSignature };

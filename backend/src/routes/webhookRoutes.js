// ────────────────────────────────────────────────────────────────
// src/routes/webhookRoutes.js
// The Twilio WhatsApp webhook route (mounted at /webhook in server.js).
// Optional Twilio signature validation is applied here.
// ────────────────────────────────────────────────────────────────

const express = require('express');
const { handleIncoming } = require('../controllers/webhookController');
const { twilioSignature } = require('../middleware/twilioSignature');

const router = express.Router();

// POST /webhook/whatsapp
router.post('/whatsapp', twilioSignature, handleIncoming);

module.exports = router;

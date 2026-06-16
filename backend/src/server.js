// ────────────────────────────────────────────────────────────────
// src/server.js
// Express app entry point. Connects to MongoDB, mounts routes, starts HTTP.
//
//   /                     → health check
//   /webhook/whatsapp     → Twilio incoming messages (POST)
//   /api/orders/*         → dashboard read APIs (GET)
// ────────────────────────────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { connectDB } = require('./database/connection');
const orderRoutes = require('./routes/orderRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
// Allow the Next.js dashboard (different origin) to call our API.
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Twilio posts x-www-form-urlencoded; the dashboard posts JSON.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('WhatsApp Order Backend is running ✅'));
app.use('/webhook', webhookRoutes);
app.use('/api/orders', orderRoutes);

// ── Error handling (must be last) ─────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Boot: connect DB first, then listen ───────────────────────────
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`🚀 Server listening on http://localhost:${PORT}`);
      logger.info(`   Webhook: POST /webhook/whatsapp`);
      logger.info(`   API:     GET  /api/orders`);
      logger.info(
        `   Twilio signature validation: ${
          String(process.env.VALIDATE_TWILIO_SIGNATURE).toLowerCase() === 'true'
            ? 'ON'
            : 'OFF (local mode)'
        }`
      );
    });
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

// Only auto-start when run directly (node src/server.js). When this module is
// imported by a test harness, the test controls startup instead.
if (require.main === module) {
  start();
}

module.exports = { app, start };

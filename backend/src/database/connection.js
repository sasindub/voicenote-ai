// ────────────────────────────────────────────────────────────────
// src/database/connection.js
// Connects to MongoDB Atlas using Mongoose.
//
// WHY Mongoose: it gives us a schema (structure + validation) on top of
// MongoDB's flexible documents, plus simple model methods (find, create...).
// We connect ONCE at startup and reuse the connection for the whole app.
// ────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Open the MongoDB connection. Call this once before starting the server.
 * Throws if MONGODB_URI is missing or the connection fails, so the app
 * doesn't start half-broken.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env'
    );
  }

  // Mongoose buffers commands until connected; we disable that so a bad URI
  // fails fast instead of hanging on the first query.
  mongoose.set('bufferTimeoutMS', 8000);

  await mongoose.connect(uri, {
    // Give up trying to reach Atlas after 10s (clear error instead of hang).
    serverSelectionTimeoutMS: 10000,
  });

  logger.info('MongoDB connected ✅');

  // Helpful runtime logs if the connection drops later.
  mongoose.connection.on('error', (err) =>
    logger.error('MongoDB connection error:', err.message)
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected')
  );
}

module.exports = { connectDB };

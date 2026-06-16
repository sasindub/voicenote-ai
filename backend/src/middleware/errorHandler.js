// ────────────────────────────────────────────────────────────────
// src/middleware/errorHandler.js
// A single place to catch errors thrown in route handlers (via next(err))
// and return a clean JSON response instead of leaking a stack trace.
// ────────────────────────────────────────────────────────────────

const logger = require('../utils/logger');

// 404 for unknown routes.
function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

// Central error handler. Express recognizes it by its 4 arguments.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error('API error:', err?.message || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}

module.exports = { notFound, errorHandler };

// ────────────────────────────────────────────────────────────────
// src/utils/logger.js
// A tiny logging helper so logs are consistent and timestamped.
// (Swap this for a library like "pino" later if you want.)
// ────────────────────────────────────────────────────────────────

function stamp() {
  // ISO timestamp keeps logs sortable and unambiguous across timezones.
  return new Date().toISOString();
}

module.exports = {
  info: (...args) => console.log(`[${stamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${stamp()}] [ERROR]`, ...args),
};

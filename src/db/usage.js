// ────────────────────────────────────────────────────────────────
// src/db/usage.js
// SQLite layer using better-sqlite3.
//
// WHY better-sqlite3: it is synchronous (no async/await needed), super
// fast for small workloads, and stores everything in a single file on
// disk. Perfect for a simple usage log + monthly quota counter without
// running a separate database server.
//
// This module does two jobs:
//   1. Log every request (who, when, how big, language, success/fail).
//   2. Count how many notes a phone number has used this calendar month
//      so we can enforce the free-tier limit.
// ────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// We keep the DB file inside a "data/" folder at the project root.
// __dirname is .../src/db, so go up two levels to reach the root.
const dataDir = path.join(__dirname, '..', '..', 'data');

// Create the data/ folder if it doesn't exist yet (first run).
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'usage.sqlite');

// Open (or create) the database file.
const db = new Database(dbPath);

// WAL mode = better concurrency + speed. Safe default for a web app.
db.pragma('journal_mode = WAL');

// Create the table on startup if it isn't there yet.
// Notes on columns:
//   - month_key: "YYYY-MM" so we can count per calendar month easily.
//   - char_count / duration_sec: rough "size" of the note for logging.
//   - success: 1 or 0 so we can see failures later.
db.exec(`
  CREATE TABLE IF NOT EXISTS usage_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    from_number   TEXT    NOT NULL,
    created_at    TEXT    NOT NULL,
    month_key     TEXT    NOT NULL,
    language      TEXT,
    char_count    INTEGER DEFAULT 0,
    duration_sec  INTEGER DEFAULT 0,
    success       INTEGER DEFAULT 0
  );

  -- Index makes the monthly count query fast.
  CREATE INDEX IF NOT EXISTS idx_usage_number_month
    ON usage_log (from_number, month_key);
`);

/**
 * Returns the current calendar month as "YYYY-MM" (e.g. "2026-06").
 * Still stored on each row for reporting; no longer used for the quota.
 */
function currentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  // getMonth() is 0-based, so +1, then pad to 2 digits.
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns today's date as "YYYY-MM-DD" (e.g. "2026-06-14").
 * This is the bucket key for the DAILY quota.
 */
function currentDayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Count how many SUCCESSFUL notes this number has used TODAY.
 * We only count success=1 so failed attempts don't burn the user's quota.
 *
 * We match on the created_at timestamp's date prefix (created_at is an ISO
 * string like "2026-06-14T08:30:00.000Z"), so "today" resets at midnight.
 *
 * @param {string} fromNumber - e.g. "whatsapp:+9477..."
 * @returns {number}
 */
function getDailyCount(fromNumber) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM usage_log
        WHERE from_number = ?
          AND substr(created_at, 1, 10) = ?
          AND success = 1`
    )
    .get(fromNumber, currentDayKey());
  return row ? row.n : 0;
}

/**
 * True if this number is still under the free DAILY limit.
 *
 * @param {string} fromNumber
 * @param {number} limit - FREE_DAILY_LIMIT from env
 * @returns {boolean}
 */
function isUnderLimit(fromNumber, limit) {
  return getDailyCount(fromNumber) < limit;
}

/**
 * Write one row to the usage log.
 *
 * @param {object} entry
 * @param {string} entry.fromNumber
 * @param {string} [entry.language]
 * @param {number} [entry.charCount]
 * @param {number} [entry.durationSec]
 * @param {boolean} entry.success
 */
function logUsage({ fromNumber, language = null, charCount = 0, durationSec = 0, success }) {
  db.prepare(
    `INSERT INTO usage_log
       (from_number, created_at, month_key, language, char_count, duration_sec, success)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fromNumber,
    new Date().toISOString(),
    currentMonthKey(),
    language,
    charCount,
    durationSec,
    success ? 1 : 0
  );
}

module.exports = {
  db,
  currentMonthKey,
  currentDayKey,
  getDailyCount,
  isUnderLimit,
  logUsage,
};

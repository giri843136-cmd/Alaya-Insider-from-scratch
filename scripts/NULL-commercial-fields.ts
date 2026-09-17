/**
 * TASK 4(e) — one-off, REVERSIBLE, STAGING-ONLY.
 *
 * Sets the six fabricated editorial commercial columns to NULL on a COPY of
 * the sqlite database. NEVER point this at production. The columns are NOT
 * dropped or renamed (no schema change); values are backed up first so the
 * change can be undone.
 *
 * Backup format (JSON): rows of { id, col1, col2, ... } — the script can
 * restore them onto the same DB copy via `--restore`.
 *
 * Usage:
 *   # 1) make a working copy (never run against data/alaya.db directly)
 *   cp data/alaya.db data/staging-copy.db
 *
 *   # 2) dry-run (prints counts only, no writes):
 *   npx tsx scripts/NULL-commercial-fields.ts --db data/staging-copy.db
 *
 *   # 3) apply + write backup file:
 *   npx tsx scripts/NULL-commercial-fields.ts --db data/staging-copy.db --apply
 *
 *   # optional: revert later on the same copy
 *   npx tsx scripts/NULL-commercial-fields.ts --db data/staging-copy.db --restore
 *
 * You run this yourself against a staging copy — the agent never touches prod.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const COLUMNS = [
  'current_price',
  'previous_price',
  'rating',
  'review_count',
  'live_price',
  'live_currency',
  'live_available',
  'live_fetched_at',
] as const;

const args = process.argv.slice(2);
const dbArgIdx = args.indexOf('--db');
const DB_FILE = dbArgIdx >= 0 ? args[dbArgIdx + 1] : 'data/staging-copy.db';
const APPLY = args.includes('--apply');
const RESTORE = args.includes('--restore');

if (!fs.existsSync(DB_FILE)) {
  console.error(`Refusing to run: database file not found: ${DB_FILE}`);
  console.error('Copy your staging DB first, e.g.:  cp data/alaya.db data/staging-copy.db');
  process.exit(1);
}

// Safety check — refuse paths that look like the live production DB names.
const resolved = path.resolve(DB_FILE);
if (/(^|[\/\\])alaya\.db$/.test(resolved) || /production/i.test(resolved)) {
  console.error(`REFUSING: "${DB_FILE}" looks like a production database (${resolved}).`);
  console.error('Run this only on a staging COPY. See RUNBOOK for the procedure.');
  process.exit(1);
}

const db = new Database(DB_FILE); // read-write; creates WAL sidecars only on write

// ── Verify the columns exist (no schema change — must already be present) ──
const tableInfo = db.prepare(`PRAGMA table_info(products)`).all() as { name: string }[];
const existing = new Set(tableInfo.map(c => c.name));
const missing = COLUMNS.filter(c => !existing.has(c));
if (missing.length) {
  console.error(`REFUSING: products table is missing expected columns: ${missing.join(', ')}`);
  db.close();
  process.exit(1);
}

const backupFile = `${DB_FILE}.commercial-fields-backup.json`;

if (RESTORE) {
  if (!fs.existsSync(backupFile)) {
    console.error(`No backup file found at ${backupFile} — nothing to restore.`);
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const tx = db.transaction(() => {
    const setFrag = COLUMNS.map(c => `${c} = ?`).join(', ');
    const upd = db.prepare(`UPDATE products SET ${setFrag} WHERE id = ?`);
    let n = 0;
    for (const row of rows) {
      n += upd.run(...COLUMNS.map(c => row[c]), row.id).changes;
    }
    return n;
  });
  const restored = tx();
  console.log(`Restored ${restored} product row(s) from ${backupFile}`);
  db.close();
  process.exit(0);
}

// ── Snapshot the current values (the undo data) ──
const selectCols = ['id', ...COLUMNS].join(', ');
const rows = db.prepare(`SELECT ${selectCols} FROM products`).all();

const nonNull = (r: any) => COLUMNS.filter(c => r[c] !== null && r[c] !== undefined).length;
const touched = rows.filter(nonNull);
console.log(`Products in DB copy: ${rows.length}`);
console.log(`Rows with at least one non-NULL commercial field: ${touched.length}`);

if (!APPLY) {
  console.log('\nDRY RUN — no writes performed. Re-run with --apply to:');
  console.log(`  1. back up current values to ${backupFile}`);
  console.log(`  2. run: UPDATE products SET current_price = NULL, previous_price = NULL, rating = NULL, review_count = NULL, live_price = NULL, live_currency = NULL, live_available = NULL, live_fetched_at = NULL;`);
  console.log('\nSQL that would run:');
  console.log(`  UPDATE products SET ${COLUMNS.map(c => `${c} = NULL`).join(', ')};`);
  db.close();
  process.exit(0);
}

// ── Apply: backup + NULL in one transaction ──
const tx = db.transaction(() => {
  fs.writeFileSync(backupFile, JSON.stringify(rows, null, 2));
  db.prepare(`UPDATE products SET ${COLUMNS.map(c => `${c} = NULL`).join(', ')}`).run();
});
tx();

const after = db.prepare(`SELECT COUNT(*) AS n FROM products WHERE current_price IS NOT NULL OR previous_price IS NOT NULL OR rating IS NOT NULL OR review_count IS NOT NULL OR live_price IS NOT NULL OR live_currency IS NOT NULL OR live_available IS NOT NULL OR live_fetched_at IS NOT NULL`).get() as { n: number };
console.log(`Applied. Rows still holding a non-NULL commercial field: ${after.n} (expected 0).`);
console.log(`Backup written to ${backupFile} — keep it if you may want --restore.`);
db.close();

/**
 * Login lockout — 5 consecutive failures → 15-minute lock, per account AND
 * per IP, backed by the existing sqlite database (no new service, no cron —
 * expired rows are simply ignored by readers and overwritten by writers).
 *
 * Why sqlite instead of the in-process Map in rate-limit.ts: the lockout must
 * hold even if the route handler module reloads, and it keeps all auth state
 * in the existing database. The table is created lazily with IF NOT EXISTS so
 * this module stays usable in tests.
 *
 * Two counters per identifier:
 *   fail_count — consecutive failures since the last success / stale reset
 *   locked_until — when non-null and in the future, logins are refused
 *
 * An identifier is "locked" when locked_until > now. After the lock expires,
 * fail_count starts from zero again (a fresh guessing budget), which matches
 * the "5 failures -> 15-minute lockout" requirement without a background job.
 * Writes are read-modify-write through better-sqlite3's synchronous, single
 * process model, so there is no cross-request race to guard against.
 */
import getDb from './db';

export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * FIX G — the shared bucket for requests whose client IP could not be
 * trusted (missing/multi-element/unparseable X-Forwarded-For) NEVER locks.
 *
 * Why: the bucket aggregates every header-stripped request into one key, so
 * locking it at MAX_FAILURES would let any attacker (or an edge misconfig)
 * lock ALL such traffic — including legitimate admins — out of the login for
 * 15 minutes: a self-DoS. The ACCOUNT lock is the authoritative control and
 * still applies to every failed attempt regardless of IP trustability.
 * Failures against the bucket keep being recorded (fail_count) so scanners
 * remain visible in logs and in getLockStatus().
 */
export const UNTRUSTABLE_BUCKET = 'shared:untrustable-ip';

let tableReady = false;
function ensureTable() {
  if (tableReady) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS login_lockouts (
      identifier TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_failure_at TEXT
    );
  `);
  tableReady = true;
}

interface LockRow {
  identifier: string;
  fail_count: number;
  locked_until: string | null;
  last_failure_at: string | null;
}

function getRow(identifier: string): LockRow | undefined {
  ensureTable();
  return getDb().prepare('SELECT identifier, fail_count, locked_until, last_failure_at FROM login_lockouts WHERE identifier = ?')
    .get(identifier) as LockRow | undefined;
}

function isActive(until: string | null): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > Date.now();
}

export interface LockStatus {
  locked: boolean;
  /** seconds remaining on the active lock (0 when not locked) */
  retryAfterSeconds: number;
  /** failures already recorded in the current window */
  failures: number;
}

/** Read-only check used by the login route before verifying credentials. */
export function getLockStatus(identifier: string): LockStatus {
  const row = getRow(identifier);
  if (row && isActive(row.locked_until)) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(row.locked_until as string) - Date.now()) / 1000));
    return { locked: true, retryAfterSeconds, failures: row.fail_count };
  }
  return { locked: false, retryAfterSeconds: 0, failures: row?.fail_count ?? 0 };
}

/** True when the given account OR the IP is currently locked out. */
export function isLockedOut(account: string, ip: string): boolean {
  return getLockStatus(account).locked || getLockStatus(ip).locked;
}

/** Record a failed attempt against BOTH the account and the IP. Locks at MAX_FAILURES.
 *  FIX G: the shared untrustable bucket records but never locks. */
export function recordFailure(account: string, ip: string): void {
  const now = new Date().toISOString();
  const lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
  ensureTable();
  const upsert = getDb().prepare(`
    INSERT INTO login_lockouts (identifier, fail_count, locked_until, last_failure_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(identifier) DO UPDATE SET
      fail_count = excluded.fail_count,
      locked_until = excluded.locked_until,
      last_failure_at = excluded.last_failure_at
  `);
  for (const id of [account, ip]) {
    const row = getRow(id);
    // A lock that has already expired does not count against the new window.
    const stale = row?.locked_until ? !isActive(row.locked_until) : false;
    const count = (stale ? 0 : row?.fail_count ?? 0) + 1;
    // FIX G: the untrustable bucket keeps counting but never reaches a lock.
    const mayLock = id !== UNTRUSTABLE_BUCKET;
    upsert.run(id, count, mayLock && count >= MAX_FAILURES ? lockedUntil : null, now);
  }
}

/**
 * FIX C (TASK 2): clear the lockout for BOTH the account key and the IP (or
 * shared untrustable bucket) key of the successful request, so a legit admin
 * signing in is never stuck behind an IP counter accumulated from earlier
 * failures.
 */
export function recordSuccess(account: string, ip: string): void {
  ensureTable();
  getDb().prepare('DELETE FROM login_lockouts WHERE identifier = ? OR identifier = ?').run(account, ip);
}

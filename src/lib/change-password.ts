/**
 * Self-service admin password change (TASK 30).
 *
 * Rules enforced here:
 *  - the CURRENT password is mandatory and must verify against the stored
 *    bcrypt hash before anything is written;
 *  - the new password must be at least MIN_PASSWORD_LENGTH characters and
 *    must differ from the current one;
 *  - hashing is bcryptjs with cost 10 (matches src/lib/auth.ts hashPassword);
 *  - nothing is ever logged and the hash is never returned to the caller.
 *
 * Throttling lives in the route (it owns the request): the endpoint shares
 * the SAME per-IP and per-account buckets as /api/auth/login — see
 * src/app/api/auth/change-password/route.ts.
 *
 * Session invalidation: this module is the ONLY writer of users.updated_at
 * (verified by grep across src/ — 2FA and login write other columns), and
 * src/lib/auth.ts rejects tokens whose iat predates it. That is the
 * schema-frozen "sign out everywhere" mechanism.
 */
import bcryptjs from 'bcryptjs';
import type Database from 'better-sqlite3';

export const MIN_PASSWORD_LENGTH = 12;

export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      reason: 'validation' | 'wrong-current' | 'not-found';
    };

export function changeOwnPassword(
  db: Database.Database,
  userId: string,
  currentPassword: unknown,
  newPassword: unknown,
): ChangePasswordResult {
  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    return { ok: false, status: 400, error: 'Current password is required.', reason: 'validation' };
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      reason: 'validation',
    };
  }
  if (newPassword === currentPassword) {
    return {
      ok: false,
      status: 400,
      error: 'New password must differ from the current password.',
      reason: 'validation',
    };
  }

  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ? AND is_active = 1')
    .get(userId) as { password_hash: string } | undefined;
  if (!row || !row.password_hash) {
    return { ok: false, status: 404, error: 'User not found.', reason: 'not-found' };
  }

  if (!bcryptjs.compareSync(currentPassword, row.password_hash)) {
    return { ok: false, status: 400, error: 'Current password is incorrect.', reason: 'wrong-current' };
  }

  const newHash = bcryptjs.hashSync(newPassword, 10);
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(newHash, userId);

  return { ok: true };
}

/**
 * Convert a users.updated_at value (sqlite `datetime('now')` output, e.g.
 * '2026-09-18 08:00:00' UTC, or an ISO string) into epoch milliseconds.
 * Returns null when the value is absent or unparseable — tokens are then
 * NEVER invalidated (fail-open, so a data hiccup cannot log everyone out).
 */
export function sessionInvalidatedAt(updatedAtText: unknown): number | null {
  if (typeof updatedAtText !== 'string' || updatedAtText.trim() === '') return null;
  let s = updatedAtText.trim();
  if (!s.includes('T')) s = s.replace(' ', 'T');
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

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
 */
import bcryptjs from 'bcryptjs';
import type Database from 'better-sqlite3';

export const MIN_PASSWORD_LENGTH = 12;

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function changeOwnPassword(
  db: Database.Database,
  userId: string,
  currentPassword: unknown,
  newPassword: unknown,
): ChangePasswordResult {
  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    return { ok: false, status: 400, error: 'Current password is required.' };
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (newPassword === currentPassword) {
    return { ok: false, status: 400, error: 'New password must differ from the current password.' };
  }

  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ? AND is_active = 1')
    .get(userId) as { password_hash: string } | undefined;
  if (!row || !row.password_hash) {
    return { ok: false, status: 404, error: 'User not found.' };
  }

  if (!bcryptjs.compareSync(currentPassword, row.password_hash)) {
    return { ok: false, status: 400, error: 'Current password is incorrect.' };
  }

  const newHash = bcryptjs.hashSync(newPassword, 10);
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(newHash, userId);

  return { ok: true };
}

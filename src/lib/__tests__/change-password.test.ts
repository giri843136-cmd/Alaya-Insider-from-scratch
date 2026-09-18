/**
 * TASK 30 — tests for the self-service password change core.
 *
 * The critical security property: a WRONG current password must never be
 * able to change the stored hash.
 */
import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import { changeOwnPassword, MIN_PASSWORD_LENGTH } from '@/lib/change-password';

const CURRENT = 'correct-current-pass';
const NEW = 'brand-new-password-12ch';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .run('u1', 'admin@example.com', bcryptjs.hashSync(CURRENT, 10));
  return db;
}

describe('changeOwnPassword (TASK 30)', () => {
  it('refuses a wrong current password and leaves the hash unchanged', () => {
    const db = makeDb();
    const before = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u1') as any).password_hash;

    const res = changeOwnPassword(db, 'u1', 'wrong-current-pass', NEW);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('Current password is incorrect.');
    const after = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u1') as any).password_hash;
    expect(after).toBe(before);
  });

  it('changes the hash with the correct current password (bcrypt cost >= 10)', () => {
    const db = makeDb();
    const res = changeOwnPassword(db, 'u1', CURRENT, NEW);
    expect(res.ok).toBe(true);

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u1') as any;
    expect(row.password_hash).not.toBe(bcryptjs.hashSync(CURRENT, 10));
    expect(row.password_hash.startsWith('$2')).toBe(true);
    // bcrypt cost factor is encoded in the hash: $2a$10$...
    expect(row.password_hash.split('$')[2]).toBe('10');
    expect(bcryptjs.compareSync(NEW, row.password_hash)).toBe(true);
    expect(bcryptjs.compareSync(CURRENT, row.password_hash)).toBe(false);
  });

  it('rejects a too-short new password without touching the hash', () => {
    const db = makeDb();
    const before = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u1') as any).password_hash;
    const res = changeOwnPassword(db, 'u1', CURRENT, 'short');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(String(MIN_PASSWORD_LENGTH));
    const after = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u1') as any).password_hash;
    expect(after).toBe(before);
  });

  it('rejects a new password identical to the current one', () => {
    const db = makeDb();
    const res = changeOwnPassword(db, 'u1', CURRENT, CURRENT);
    expect(res.ok).toBe(false);
  });

  it('requires a current password', () => {
    const db = makeDb();
    const res = changeOwnPassword(db, 'u1', '', NEW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Current password is required');
  });

  it('404s for an unknown or inactive user', () => {
    const db = makeDb();
    expect(changeOwnPassword(db, 'missing', CURRENT, NEW).ok).toBe(false);
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run('u1');
    expect(changeOwnPassword(db, 'u1', CURRENT, NEW).ok).toBe(false);
  });

  it('never logs the password material', () => {
    const calls: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { calls.push(a.join(' ')); });
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => { calls.push(a.join(' ')); });
    const spyError = jest.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { calls.push(a.join(' ')); });

    const db = makeDb();
    changeOwnPassword(db, 'u1', 'wrong-current-pass', NEW);
    changeOwnPassword(db, 'u1', CURRENT, NEW);

    expect(calls.join('\n')).not.toContain(NEW);
    expect(calls.join('\n')).not.toContain(CURRENT);

    spy.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });
});

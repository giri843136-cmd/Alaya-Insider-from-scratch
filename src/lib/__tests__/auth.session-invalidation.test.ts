/**
 * TASK 30 — sign out everywhere.
 *
 * Proves getAuthUser rejects tokens whose iat is at or before
 * users.updated_at (the timestamp ONLY the password-change flow writes),
 * fails OPEN on unparseable/absent timestamps, and that a successful
 * changeOwnPassword call kills a previously valid token — end to end,
 * without any DB schema change.
 *
 * Uses a real tmp-file database via the real DATABASE_PATH (no module
 * mocks for the db), so the auth module's cached connection sees exactly
 * what a production request would see.
 */
import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = 'test-secret-value-0123456789abcdef';
const tmpDbPath = require('os').tmpdir() + `/alaya-sess-${Date.now()}.db`;
process.env.AUTH_SECRET = SECRET;
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = tmpDbPath;

const holder: { auth: string | null } = { auth: null };
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => ({
    get: (k: string) => (k.toLowerCase() === 'authorization' ? holder.auth : null),
  })),
  cookies: jest.fn(async () => ({ get: () => undefined })),
}));

const CURRENT = 'correct-current-pass';
const NEW = 'brand-new-password-12ch';
const PAST = '2026-01-01 00:00:00';

function tokenFor(): string {
  return jwt.sign({ id: 'u1', email: 'admin@example.com', role: 'super_admin' }, SECRET, { expiresIn: '1h' });
}

describe('sign out everywhere (session invalidation via users.updated_at)', () => {
  let getAuthUser: () => Promise<any>;
  let changeOwnPassword: typeof import('@/lib/change-password').changeOwnPassword;
  let sessionInvalidatedAt: typeof import('@/lib/change-password').sessionInvalidatedAt;
  let db: Database.Database;

  beforeAll(async () => {
    db = new Database(tmpDbPath);
    db.exec(`
      CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT, permissions TEXT DEFAULT '{}');
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL, username TEXT NOT NULL,
        password_hash TEXT NOT NULL, role_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        two_factor_enabled INTEGER NOT NULL DEFAULT 0, two_factor_secret TEXT DEFAULT '',
        updated_at TEXT
      );
      INSERT INTO roles (id, name, permissions) VALUES ('r1', 'super_admin', '{"all":true}');
    `);
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, role_id, updated_at)
      VALUES ('u1', 'admin@example.com', 'admin', ?, 'r1', ?)
    `).run(bcryptjs.hashSync(CURRENT, 10), PAST);

    ({ getAuthUser } = await import('@/lib/auth'));
    ({ changeOwnPassword, sessionInvalidatedAt } = await import('@/lib/change-password'));
  });

  afterAll(() => { try { db.close(); } catch { /* noop */ } });

  beforeEach(() => {
    // Deterministic starting state for every test.
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(bcryptjs.hashSync(CURRENT, 10), PAST, 'u1');
    holder.auth = null;
  });

  async function authWith(token: string | null) {
    holder.auth = token ? `Bearer ${token}` : null;
    return getAuthUser();
  }

  it('accepts a token issued AFTER the last credential change', async () => {
    await expect(authWith(tokenFor())).resolves.toMatchObject({ id: 'u1' });
  });

  it('rejects a token issued AT OR BEFORE users.updated_at', async () => {
    const token = tokenFor();
    // Simulate a credential change recorded at/after the token's iat
    // (+1s keeps the boundary unambiguous and deterministic).
    const future = new Date(Date.now() + 1000).toISOString();
    db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(future, 'u1');
    await expect(authWith(token)).resolves.toBeNull();
  });

  it('end to end: the SAME token dies after a successful password change', async () => {
    const token = tokenFor();
    await expect(authWith(token)).resolves.toMatchObject({ id: 'u1' });

    // updated_at has second precision, so change strictly after the token's
    // iat second to keep the assertion deterministic.
    await new Promise((r) => setTimeout(r, 1100));
    const res = changeOwnPassword(db, 'u1', CURRENT, NEW);
    expect(res.ok).toBe(true);

    await expect(authWith(token)).resolves.toBeNull();
  });

  it('the NEW password now works and the old one is dead', async () => {
    await new Promise((r) => setTimeout(r, 1100));
    expect(changeOwnPassword(db, 'u1', CURRENT, NEW).ok).toBe(true);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u1') as any;
    expect(bcryptjs.compareSync(NEW, row.password_hash)).toBe(true);
    expect(bcryptjs.compareSync(CURRENT, row.password_hash)).toBe(false);
  });

  it('fails OPEN: null or unparseable updated_at never invalidates sessions', async () => {
    const token = tokenFor();
    db.prepare('UPDATE users SET updated_at = NULL WHERE id = ?').run('u1');
    await expect(authWith(token)).resolves.toMatchObject({ id: 'u1' });

    db.prepare("UPDATE users SET updated_at = 'garbage' WHERE id = ?").run('u1');
    await expect(authWith(token)).resolves.toMatchObject({ id: 'u1' });
  });

  it('sessionInvalidatedAt parses sqlite datetime strings as UTC', () => {
    expect(sessionInvalidatedAt('2026-09-18 08:00:00')).toBe(Date.parse('2026-09-18T08:00:00Z'));
    expect(sessionInvalidatedAt('2026-09-18T08:00:00Z')).toBe(Date.parse('2026-09-18T08:00:00Z'));
    expect(sessionInvalidatedAt('')).toBeNull();
    expect(sessionInvalidatedAt(undefined)).toBeNull();
    expect(sessionInvalidatedAt('not-a-date')).toBeNull();
  });
});

/**
 * TASK 30 — route-level protections for POST /api/auth/change-password.
 *
 * Proves the endpoint shares the EXACT per-IP/per-account buckets with
 * /api/auth/login: consecutive wrong-current-password attempts feed the
 * durable sqlite lockout and the account gets locked at MAX_FAILURES,
 * returning 429 WITHOUT reaching bcrypt again.
 */
import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = 'test-secret-value-0123456789abcdef';
const tmpDbPath = require('os').tmpdir() + `/alaya-cp-route-${Date.now()}.db`;
process.env.AUTH_SECRET = SECRET;
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = tmpDbPath;

// In-process request context for getAuthUser(): we drive the Authorization
// header per test through this holder.
const holder: { auth: string | null } = { auth: null };
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => ({
    get: (k: string) => (k.toLowerCase() === 'authorization' ? holder.auth : null),
  })),
  cookies: jest.fn(async () => ({ get: () => undefined })),
}));

// The route only needs ensureDbReady to be a no-op here: the schema module
// transitively imports uuid v14 (ESM-only), which jest cannot parse.
jest.mock('@/lib/init', () => ({ ensureDbReady: () => {} }));

describe('change-password route: lockout + gating', () => {
  let POST: (req: any) => Promise<Response>;
  let db: Database.Database;
  const CURRENT = 'correct-current-pass';
  const NEW = 'brand-new-password-12ch';
  const TOKEN = jwt.sign({ id: 'u1', email: 'admin@example.com', role: 'super_admin' }, SECRET, {
    expiresIn: '1h',
  });

  beforeAll(async () => {
    db = new Database(tmpDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT, permissions TEXT DEFAULT '{}');
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, role_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        two_factor_enabled INTEGER NOT NULL DEFAULT 0, two_factor_secret TEXT DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.prepare("INSERT OR IGNORE INTO roles (id, name, permissions) VALUES ('r1', 'super_admin', '{\"all\":true}')").run();
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, role_id, updated_at)
      VALUES ('u1', 'admin@example.com', 'admin', ?, 'r1', '2026-01-01 00:00:00')
      ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, is_active = 1
    `).run(bcryptjs.hashSync(CURRENT, 10));

    ({ POST } = await import('@/app/api/auth/change-password/route'));
  });

  afterAll(() => { try { db.close(); } catch { /* noop */ } });

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.9',
        ...(holder.auth ? { authorization: holder.auth } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it('401s without a session (server-side gate)', async () => {
    holder.auth = null;
    const res = await POST(makeRequest({ current_password: CURRENT, new_password: NEW }));
    expect(res.status).toBe(401);
  });

  it('locks the account after MAX_FAILURES wrong current passwords, without reaching bcrypt again', async () => {
    holder.auth = `Bearer ${TOKEN}`;
    const compareSpy = jest.spyOn(bcryptjs, 'compareSync');

    // MAX_FAILURES consecutive wrong-current attempts -> 400 each, counted.
    let last: Response | null = null;
    for (let i = 0; i < 5; i++) {
      last = (await POST(makeRequest({ current_password: 'wrong-guess-' + i, new_password: NEW }))) as Response;
      expect(last.status).toBe(400);
    }
    const countAtLock = compareSpy.mock.calls.length;
    expect(countAtLock).toBeGreaterThan(0); // bcrypt DID run while not locked

    // 6th attempt: locked BEFORE any credential verification (429 + Retry-After).
    const locked = (await POST(makeRequest({ current_password: 'wrong-guess-late', new_password: NEW }))) as Response;
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBeTruthy();
    // Proves the lock check precedes bcrypt: no additional compare calls.
    expect(compareSpy.mock.calls.length).toBe(countAtLock);

    compareSpy.mockRestore();
  });

  it('successful change returns 200, clears the cookie, and resets the lockout counters', async () => {
    // Fresh IP bucket so the in-memory limiter/lockout state from the previous
    // test does not bleed into the success path.
    const { recordSuccess } = await import('@/lib/login-lockout');
    recordSuccess('admin@example.com', '203.0.113.9');

    holder.auth = `Bearer ${TOKEN}`;
    const res = (await POST(makeRequest({ current_password: CURRENT, new_password: NEW }))) as Response;
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain('auth_token=');
    expect(setCookie).toContain('Max-Age=0');

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u1') as any;
    expect(bcryptjs.compareSync(NEW, row.password_hash)).toBe(true);

    const { getLockStatus } = await import('@/lib/login-lockout');
    expect(getLockStatus('admin@example.com').failures).toBe(0);
    expect(getLockStatus('203.0.113.9').failures).toBe(0);
  });
});

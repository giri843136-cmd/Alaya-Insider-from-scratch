/**
 * TASK 31b — endpoint gates for the snapshot surfaces (WAVE 1).
 *
 *   GET/POST /api/admin/snapshots  -> session-gated (getAuthUser); the status
 *     body reports env variable NAMES only, never values.
 *   GET/POST /api/cron/snapshot    -> header-secret-gated (x-cron-secret |
 *     x-api-key === CRON_SECRET); no query-string secret is accepted; without
 *     SNAPSHOT_DIR the route answers 409 "UNSET" (snapshots disabled), never
 *     a guessed default path.
 */
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = 'test-secret-value-0123456789abcdef';
process.env.AUTH_SECRET = SECRET;
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = require('os').tmpdir() + `/alaya-snap-route-${Date.now()}.db`;
delete process.env.SNAPSHOT_DIR; // policy: unset -> disabled -> 409
const CRON_SECRET = 'test-cron-secret-9f8e7d6c5b4a';
process.env.CRON_SECRET = CRON_SECRET;

// getAuthUser reads the authorization header and expects `Bearer <jwt>`.
const holder: { auth: string | null } = { auth: null };
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => ({
    get: (k: string) => (k.toLowerCase() === 'authorization' ? holder.auth : null),
  })),
  cookies: jest.fn(async () => ({ get: () => undefined })),
}));

jest.mock('@/lib/init', () => ({ ensureDbReady: () => {} }));

// uuid v14 is ESM-only and jest cannot parse it; the schema seed only needs unique ids.
jest.mock('uuid', () => ({
  v4: () => 'snap-test-' + Math.random().toString(36).slice(2, 10),
}));

const TEST_ADMIN_ID = 'snap-test-admin-0001';

function makeRequest(url: string, method: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, { method, headers }) as never;
}

function adminToken(): string {
  return jwt.sign(
    { id: TEST_ADMIN_ID, email: 'admin@example.com', role: 'super_admin' },
    SECRET,
    { expiresIn: '1h' },
  );
}

describe('TASK 31b snapshot endpoints', () => {
  let adminRoute: Record<string, unknown>;
  let cronRoute: Record<string, unknown>;

  beforeAll(async () => {
    // REAL schema module against the scratch DB — no hand-copied DDL, so the
    // test can never drift from production DDL (the WAVE 0.5 lesson).
    const schema = await import('@/lib/schema');
    schema.initializeDatabase();
    schema.seedRoles();
    // Known test admin with a KNOWN id (getAuthUser looks up decoded.id) and
    // a back-dated updated_at (TASK 30: token iat must post-date the last
    // credential change, second precision).
    const db = require('better-sqlite3')(process.env.DATABASE_PATH);
    const roleId = (
      db.prepare("SELECT id FROM roles WHERE name = 'super_admin'").get() as any
    ).id;
    db.prepare(
      `INSERT OR REPLACE INTO users
         (id, email, username, password_hash, first_name, last_name, role_id, is_active, updated_at)
       VALUES (?, 'admin@example.com', 'admin', ?, 'Test', 'Admin', ?, 1, datetime('now', '-1 hour'))`,
    ).run(TEST_ADMIN_ID, bcryptjs.hashSync('irrelevant-for-endpoint-tests', 4), roleId);
    db.close();
    adminRoute = await import('@/app/api/admin/snapshots/route');
    cronRoute = await import('@/app/api/cron/snapshot/route');
  });

  afterAll(() => {
    delete process.env.CRON_SECRET;
  });

  // ── admin status/trigger: session-gated ────────────────────────────────
  it('GET /api/admin/snapshots returns 401 without a session', async () => {
    holder.auth = null;
    const res = await adminRoute.GET(makeRequest('/api/admin/snapshots', 'GET'));
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/snapshots returns 401 without a session', async () => {
    holder.auth = null;
    const res = await adminRoute.POST(makeRequest('/api/admin/snapshots', 'POST'));
    expect(res.status).toBe(401);
  });

  it('GET with a session reports configured:false / UNSET and env NAMES only', async () => {
    holder.auth = `Bearer ${adminToken()}`;
    const res = await adminRoute.GET(makeRequest('/api/admin/snapshots', 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.reason).toBe('UNSET');
    expect(body.envVarNames).toEqual(['SNAPSHOT_DIR', 'SNAPSHOT_KEEP']);
    // never values: no env value or path may appear in the status body
    expect(JSON.stringify(body)).not.toContain(process.env.DATABASE_PATH as string);
    expect(body.snapshots).toEqual([]);
  });

  it('POST with a session but unset SNAPSHOT_DIR is 409 UNSET — disabled, not guessed', async () => {
    holder.auth = `Bearer ${adminToken()}`;
    const res = await adminRoute.POST(makeRequest('/api/admin/snapshots', 'POST'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('UNSET');
  });

  // ── cron trigger: header-secret-gated, no query-string secrets ─────────
  it('POST /api/cron/snapshot returns 401 without the header', async () => {
    const res = await cronRoute.POST(makeRequest('/api/cron/snapshot', 'POST'));
    expect(res.status).toBe(401);
  });

  it('POST /api/cron/snapshot returns 401 with a WRONG header value', async () => {
    const res = await cronRoute.POST(
      makeRequest('/api/cron/snapshot', 'POST', { 'x-cron-secret': 'not-it' }),
    );
    expect(res.status).toBe(401);
  });

  it('POST with the correct x-cron-secret reaches policy: 409 UNSET (no SNAPSHOT_DIR)', async () => {
    const res = await cronRoute.POST(
      makeRequest('/api/cron/snapshot', 'POST', { 'x-cron-secret': CRON_SECRET }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe('UNSET');
  });

  it('x-api-key alias is accepted (hPanel cron UI flexibility)', async () => {
    const res = await cronRoute.POST(
      makeRequest('/api/cron/snapshot', 'POST', { 'x-api-key': CRON_SECRET }),
    );
    expect(res.status).toBe(409); // past auth, stopped by policy, not by 401
  });

  it('a ?secret= query string is NEVER accepted (log-safe design)', async () => {
    const res = await cronRoute.POST(
      makeRequest(`/api/cron/snapshot?secret=${encodeURIComponent(CRON_SECRET)}`, 'POST'),
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/cron/snapshot behaves like POST (same gate, same 409)', async () => {
    const noHeader = await cronRoute.GET(makeRequest('/api/cron/snapshot', 'GET'));
    expect(noHeader.status).toBe(401);
    const withHeader = await cronRoute.GET(
      makeRequest('/api/cron/snapshot', 'GET', { 'x-cron-secret': CRON_SECRET }),
    );
    expect(withHeader.status).toBe(409);
  });
});

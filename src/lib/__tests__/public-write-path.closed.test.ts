/**
 * WAVE 0.5 step 6 — the public /api/products write path is CLOSED.
 *
 * The old public POST /api/products and PUT/DELETE /api/products/[id] carried
 * session-gated writes; ProductEditor.tsx uses /api/admin/products. A second,
 * single-gated write route meant one stolen session cookie could write without
 * the admin middleware layer, and every unauthenticated write reached the
 * handler before its 401. Every mutating method now answers a uniform 401 —
 * with a session OR without one — and never runs write logic.
 */
import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = 'test-secret-value-0123456789abcdef';
const tmpDbPath = require('os').tmpdir() + `/alaya-public-write-${Date.now()}.db`;
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

// Route init only — the scratch DB below IS the database.
jest.mock('@/lib/init', () => ({ ensureDbReady: () => {} }));

const TOKEN = jwt.sign({ id: 'u1', email: 'admin@example.com', role: 'super_admin' }, SECRET, {
  expiresIn: '1h',
});

function makeRequest(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(holder.auth ? { authorization: holder.auth } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  } as RequestInit);
}

async function callHandler(
  mod: Record<string, unknown>,
  name: string,
  req: Request,
  routeParams?: { params: Promise<{ id: string }> },
): Promise<Response> {
  const handler = mod[name];
  if (typeof handler !== 'function') {
    throw new Error(
      `${name} handler DOES NOT EXIST on this route module — a missing export answers 405, not 401.`,
    );
  }
  return (handler as any)(req, routeParams);
}

describe('public /api/products write path is CLOSED (401 for everyone, session or not)', () => {
  let publicListRoute: Record<string, unknown>;
  let publicIdRoute: Record<string, unknown>;

  beforeAll(async () => {
    const db = new Database(tmpDbPath);
    db.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT);`);
    db.close();
    publicListRoute = await import('@/app/api/products/route');
    publicIdRoute = await import('@/app/api/products/[id]/route');
  });

  it('unauthenticated POST /api/products returns 401', async () => {
    holder.auth = null;
    const res = await callHandler(publicListRoute, 'POST', makeRequest('/api/products', 'POST', {}));
    expect(res.status).toBe(401);
  });

  it('EVEN AUTHENTICATED POST /api/products returns 401 — the write path is gone, not gated', async () => {
    holder.auth = `Bearer ${TOKEN}`;
    const res = await callHandler(publicListRoute, 'POST', makeRequest('/api/products', 'POST', { name: 'x' }));
    expect(res.status).toBe(401);
  });

  it('PUT/PATCH/POST/DELETE on /api/products (collection) all return 401', async () => {
    holder.auth = null;
    for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
      const res = await callHandler(publicListRoute, method, makeRequest('/api/products', method, {}));
      expect(res.status).toBe(401);
    }
  });

  it('unauthenticated PUT /api/products/[id] returns 401', async () => {
    holder.auth = null;
    const res = await callHandler(
      publicIdRoute, 'PUT', makeRequest('/api/products/some-id', 'PUT', {}),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('EVEN AUTHENTICATED PUT /api/products/[id] returns 401', async () => {
    holder.auth = `Bearer ${TOKEN}`;
    const res = await callHandler(
      publicIdRoute, 'PUT', makeRequest('/api/products/some-id', 'PUT', { name: 'x' }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('unauthenticated PATCH /api/products/[id] returns 401 (no more bare 405)', async () => {
    holder.auth = null;
    const res = await callHandler(
      publicIdRoute, 'PATCH', makeRequest('/api/products/some-id', 'PATCH', {}),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('unauthenticated POST and DELETE /api/products/[id] return 401', async () => {
    holder.auth = null;
    for (const method of ['POST', 'DELETE'] as const) {
      const res = await callHandler(
        publicIdRoute, method, makeRequest('/api/products/some-id', method, method === 'POST' ? {} : undefined),
        { params: Promise.resolve({ id: 'some-id' }) },
      );
      expect(res.status).toBe(401);
    }
  });
});


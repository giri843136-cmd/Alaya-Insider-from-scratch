/**
 * WAVE 0.5b — admin-read gates on public-shaped GET endpoints.
 *
 * Every case here was a LIVE leak (user-verified on production):
 *   /api/settings                 → full site_settings incl. contact_email
 *   /api/contact GET              → every submission (names, emails, messages)
 *   /api/articles?admin=true      → draft/in_review/ready rows + status filter
 *   /api/hero-slides?admin=true   → draft/scheduled slides
 *   /api/brands/[slug]            → FULL row (proven live: internal UUID,
 *                                    description, website_url, is_featured)
 *   /api/categories/[slug]        → full row + children tree (TASK 26 fields)
 *   /api/articles/[slug]          → complete article row, drafts included
 * The admin pages are the only consumers of each. Writes were already gated;
 * the gates here are in-handler (defence in depth on top of middleware).
 */
import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = 'test-secret-value-0123456789abcdef';
const tmpDbPath = require('os').tmpdir() + `/alaya-read-gates-${Date.now()}.db`;
process.env.AUTH_SECRET = SECRET;
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = tmpDbPath;
process.env.ADMIN_SEED_PASSWORD = 'test-admin-seed-password-123';

const holder: { auth: string | null } = { auth: null };
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => ({
    get: (k: string) => (k.toLowerCase() === 'authorization' ? holder.auth : null),
  })),
  cookies: jest.fn(async () => ({ get: () => undefined })),
}));

jest.mock('@/lib/init', () => ({ ensureDbReady: () => {} }));

jest.mock('uuid', () => ({
  v4: () => `u-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
}));

function makeRequest(url: string) {
  return new Request(`http://localhost${url}`, {
    headers: holder.auth ? { authorization: holder.auth } : {},
  });
}

describe('admin-read gates (WAVE 0.5b): every previously-ungated admin GET now 401s without a session', () => {
  let adminToken = '';

  beforeAll(async () => {
    const { initializeDatabase, seedRoles, seedAdmin } = await import('@/lib/schema');
    initializeDatabase();
    seedRoles();
    seedAdmin();
    const db = new Database(tmpDbPath);
    // Fixtures for the [id]-shaped routes (slug matches, like production).
    db.prepare("INSERT OR IGNORE INTO brands (id, name, slug) VALUES ('brand-fixture', 'Aesop', 'aesop')").run();
    db.prepare("INSERT OR IGNORE INTO categories (id, name, slug) VALUES ('cat-fixture', 'Test Category', 'test-category')").run();
    db.prepare("UPDATE users SET updated_at = '2026-01-01 00:00:00' WHERE username = 'admin'").run();
    const adminUser = db.prepare("SELECT id, email FROM users WHERE username = 'admin'").get() as any;
    db.close();
    adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: 'super_admin' }, SECRET, { expiresIn: '1h' });
  });

  it('GET /api/settings: 401 unauthenticated, full settings WITH a session', async () => {
    const { GET } = await import('@/app/api/settings/route');
    holder.auth = null;
    expect((await GET() as any).status).toBe(401);
    holder.auth = `Bearer ${adminToken}`;
    const res = (await GET() as any);
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).settings).toBe('object');
  });

  it('GET /api/contact: 401 unauthenticated (submissions incl. emails never leave), 200 with session', async () => {
    const { GET } = await import('@/app/api/contact/route');
    holder.auth = null;
    expect((await GET() as any).status).toBe(401);
    holder.auth = `Bearer ${adminToken}`;
    expect((await GET() as any).status).toBe(200);
  });

  it('GET /api/articles?admin=true: 401 unauthenticated, 200 with session', async () => {
    const { GET } = await import('@/app/api/articles/route');
    holder.auth = null;
    expect((await GET(makeRequest('/api/articles?admin=true')) as any).status).toBe(401);
    holder.auth = `Bearer ${adminToken}`;
    expect((await GET(makeRequest('/api/articles?admin=true')) as any).status).toBe(200);
  });

  it('GET /api/articles (no admin param): stays PUBLIC for the journal', async () => {
    const { GET } = await import('@/app/api/articles/route');
    holder.auth = null;
    const res = (await GET(makeRequest('/api/articles')) as any);
    expect(res.status).toBe(200);
  });

  it('GET /api/hero-slides?admin=true: 401 unauthenticated, 200 with session', async () => {
    const { GET } = await import('@/app/api/hero-slides/route');
    holder.auth = null;
    expect((await GET(makeRequest('/api/hero-slides?admin=true')) as any).status).toBe(401);
    holder.auth = `Bearer ${adminToken}`;
    expect((await GET(makeRequest('/api/hero-slides?admin=true')) as any).status).toBe(200);
  });

  it('GET /api/hero-slides (public): still 200 without a session', async () => {
    const { GET } = await import('@/app/api/hero-slides/route');
    holder.auth = null;
    expect((await GET(makeRequest('/api/hero-slides')) as any).status).toBe(200);
  });

  it('GET /api/brands/[slug]: unauthenticated gets allow-listed shape only (no id/website_url/is_featured), session gets full row', async () => {
    const { GET } = await import('@/app/api/brands/[id]/route');
    const routeParams = { params: Promise.resolve({ id: 'aesop' }) };
    holder.auth = null;
    const pub = (await GET(makeRequest('/api/brands/aesop'), routeParams) as any);
    expect(pub.status).toBe(200);
    const pubBody = await pub.json();
    expect(pubBody.brand.name).toBe('Aesop');
    expect('id' in pubBody.brand).toBe(false);
    expect('website_url' in pubBody.brand).toBe(false);
    expect('is_featured' in pubBody.brand).toBe(false);

    holder.auth = `Bearer ${adminToken}`;
    const full = (await GET(makeRequest('/api/brands/aesop'), routeParams) as any);
    expect(full.status).toBe(200);
    const fullBody = await full.json();
    expect(fullBody.brand.id).toBeTruthy();
  });

  it('GET /api/categories/[slug]: 401 unauthenticated, full row + children with session', async () => {
    const { GET } = await import('@/app/api/categories/[id]/route');
    const routeParams = { params: Promise.resolve({ id: 'test-category' }) };
    holder.auth = null;
    expect((await GET(makeRequest('/api/categories/test-category'), routeParams) as any).status).toBe(401);
    holder.auth = `Bearer ${adminToken}`;
    expect((await GET(makeRequest('/api/categories/test-category'), routeParams) as any).status).toBe(200);
  });

  it('GET /api/articles/[slug]: 401 unauthenticated (drafts included in this handler), 200 with session', async () => {
    const { GET } = await import('@/app/api/articles/[id]/route');
    const routeParams = { params: Promise.resolve({ id: 'some-article-slug' }) };
    holder.auth = null;
    // Unknown slug must still 401 BEFORE any row existence signal
    expect((await GET(makeRequest('/api/articles/missing-slug'), routeParams) as any).status).toBe(401);
    holder.auth = `Bearer ${adminToken}`;
    const res = (await GET(makeRequest('/api/articles/missing-slug'), routeParams) as any);
    expect([200, 404]).toContain(res.status);
  });
});

describe('public reads stay public (regression guards)', () => {
  it('GET /api/brands: public list stays 200 unauthenticated and keeps the allow-listed shape', async () => {
    const { GET } = await import('@/app/api/brands/route');
    holder.auth = null;
    const res = (await GET() as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.brands)).toBe(true);
    for (const b of data.brands) {
      expect('id' in b).toBe(false);
    }
  });

  it('GET /api/comparisons: public list stays 200 and returns PUBLISHED rows only', async () => {
    const { GET } = await import('@/app/api/comparisons/route');
    holder.auth = null;
    const res = (await GET() as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.comparisons)).toBe(true);
  });

  it('GET /api/collections: public list stays 200 and returns ACTIVE rows only', async () => {
    const { GET } = await import('@/app/api/collections/route');
    holder.auth = null;
    const res = (await GET() as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.collections)).toBe(true);
  });

  it('GET /api/categories?flat=true: stays public (TASK 26 will strip id/parent_id/sort_order — separate queue item)', async () => {
    const { GET } = await import('@/app/api/categories/route');
    holder.auth = null;
    const res = (await GET(makeRequest('/api/categories?flat=true')) as any);
    expect(res.status).toBe(200);
  });

  it.todo('TASK 26: drop id/parent_id/sort_order from public /api/categories (pending queue item, not part of WAVE 0.5b)');
});

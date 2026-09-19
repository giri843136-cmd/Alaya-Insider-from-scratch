/**
 * WAVE 0.5 — admin product add/edit flow, end to end, in-process.
 *
 * Reproduces exactly what ProductEditor.tsx does:
 *   POST   /api/admin/products        (create draft)
 *   GET    /api/admin/products/[id]   (editor load = read back)
 *   PUT    /api/admin/products/[id]   (edit)
 *   GET    /api/admin/products/[id]   (read back)
 * against a scratch sqlite DB (no production calls).
 *
 * Phase-2 evidence (before the fix, verbatim):
 *   "POST handler DOES NOT EXIST on this route module — the admin editor's
 *    POST call has no server-side implementation (405 in production)."
 *   "PATCH handler DOES NOT EXIST on this route module — …"
 * The public /api/products write-path 401s live in public-write-path.closed.test.ts.
 */
import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = 'test-secret-value-0123456789abcdef';
const tmpDbPath = require('os').tmpdir() + `/alaya-admin-flow-${Date.now()}.db`;
process.env.AUTH_SECRET = SECRET;
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = tmpDbPath;
// Test-only seed credential (never a production secret): lets the REAL
// seedAdmin() create the admin user so the flow test exercises the genuine
// schema + seed path instead of a hand-copied DDL that can drift.
process.env.ADMIN_SEED_PASSWORD = 'test-admin-seed-password-123';

// In-process request context for getAuthUser(): per-test Authorization header.
const holder: { auth: string | null } = { auth: null };
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => ({
    get: (k: string) => (k.toLowerCase() === 'authorization' ? holder.auth : null),
  })),
  cookies: jest.fn(async () => ({ get: () => undefined })),
}));

// Route init only — the scratch DB below IS the database.
jest.mock('@/lib/init', () => ({ ensureDbReady: () => {} }));

// uuid v14 is ESM-only and jest cannot parse it; the routes only need unique ids.
jest.mock('uuid', () => ({
  v4: () => `u-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
}));

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
    throw new Error(`${name} handler DOES NOT EXIST on this route module (would be a bare 405 in production).`);
  }
  return (handler as any)(req, routeParams);
}

describe('admin product flow: create → read back → edit → read back (exact ProductEditor path)', () => {
  let adminListRoute: Record<string, unknown>;
  let adminIdRoute: Record<string, unknown>;
  let publicIdRoute: Record<string, unknown>;
  let adminToken = '';
  let createdId = '';

  beforeAll(async () => {
    // REAL schema module: initializeDatabase() + seedRoles() + seedAdmin().
    // (The first test run used a hand-copied products DDL and FAILED for a
    // real reason: "SqliteError: table products has no column named
    // us_affiliate_url" — the production migration at schema.ts:278 was
    // missing. That failure is exactly why the real DDL is used now.)
    const { initializeDatabase, seedRoles, seedAdmin } = await import('@/lib/schema');
    initializeDatabase();
    seedRoles();
    seedAdmin();

    const db = new Database(tmpDbPath);
    db.pragma('foreign_keys = ON');
    db.prepare("INSERT OR IGNORE INTO brands (id, name, slug) VALUES ('b1', 'Test Brand', 'test-brand')").run();
    db.prepare("INSERT OR IGNORE INTO categories (id, name, slug) VALUES ('c1', 'Test Category', 'test-category')").run();
    // Back-date updated_at: the real admin row predates every token. Without
    // this, TASK 30's sign-out-everywhere rule (token iat <= updated_at →
    // dead session) kills a token minted in the same second as the seed.
    db.prepare("UPDATE users SET updated_at = '2026-01-01 00:00:00' WHERE username = 'admin'").run();
    const adminUser = db.prepare("SELECT id, email FROM users WHERE username = 'admin'").get() as any;
    db.close();

    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'super_admin' },
      SECRET,
      { expiresIn: '1h' },
    );

    adminListRoute = await import('@/app/api/admin/products/route');
    adminIdRoute = await import('@/app/api/admin/products/[id]/route');
    publicIdRoute = await import('@/app/api/products/[id]/route');
  });

  it('creates a draft via POST /api/admin/products with commercial fields ABSENT (stored NULL, not fabricated)', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', {
      name: 'QA Flow Product',
      brand_id: 'b1',
      category_id: 'c1',
      short_description: 'A product created by the automated flow test.',
      status: 'draft',
      global_active: true,
      india_active: true,
      // current_price / previous_price / rating / review_count / currency
      // intentionally ABSENT — the editor must save without inventing data
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    createdId = data.id;
    expect(createdId).toBeTruthy();
    expect(data.slug).toBe('qa-flow-product');

    const db = new Database(tmpDbPath);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(createdId) as any;
    expect(row.current_price).toBeNull();
    expect(row.previous_price).toBeNull();
    expect(row.rating).toBeNull();
    expect(row.review_count).toBeNull();
    db.close();
  });

  it('reads the created product back via GET /api/admin/products/[id] with the full row', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(
      adminIdRoute, 'GET', makeRequest(`/api/admin/products/${createdId}`, 'GET'),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.product.id).toBe(createdId);
    expect(data.product.slug).toBe('qa-flow-product');
    expect(data.product.brand_id).toBe('b1');
  });

  it('edits via PUT /api/admin/products/[id] and the edit persists on read back', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(
      adminIdRoute, 'PUT', makeRequest(`/api/admin/products/${createdId}`, 'PUT', {
        name: 'QA Flow Product (edited)',
        status: 'ready',
        why_we_recommend: 'Because the flow test says so.',
      }),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(200);

    const read = await callHandler(
      adminIdRoute, 'GET', makeRequest(`/api/admin/products/${createdId}`, 'GET'),
      { params: Promise.resolve({ id: createdId }) },
    );
    const data = await read.json();
    expect(data.product.name).toBe('QA Flow Product (edited)');
    expect(data.product.status).toBe('ready');
  });

  it('publish validation returns human-readable blockers (422), not a generic 500', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(
      adminIdRoute, 'PUT', makeRequest(`/api/admin/products/${createdId}`, 'PUT', { status: 'published' }),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(Array.isArray(data.blockers)).toBe(true);
    expect(data.blockers).toContain('Primary image is required');
    expect(data.blockers).toContain('At least one affiliate destination is required');
  });

  it('accepts the EXACT full editor payload (every defaultProduct key) without dropping a field', async () => {
    holder.auth = `Bearer ${adminToken}`;
    // Mirrors ProductEditor defaultProduct + handleSave body shape 1:1.
    const editorBody = {
      name: 'QA Flow Product', slug: 'qa-flow-product',
      brand_id: 'b1', category_id: 'c1', subcategory_id: '', sku: '',
      current_price: 0, previous_price: null, currency: 'USD', rating: 0, review_count: 0,
      primary_image: '', image_alt: '', short_description: 'A product created by the automated flow test.',
      full_description: '', why_we_recommend: 'Because the flow test says so.', best_for: '',
      benefits: ['one'], pros: [], cons: [], buying_advice: '', tags: [],
      status: 'ready', is_featured: false, is_trending: false, is_editors_pick: false,
      affiliate_url: '', marketplace: '', affiliate_network: '', tracking_id: '', cta_text: 'Check Price',
      global_affiliate_url: 'https://www.amazon.in/dp/TESTASIN1', global_affiliate_network: 'Amazon Associates',
      global_tracking_id: '', global_cta_label: 'Explore Global Options', global_active: true,
      india_affiliate_url: 'https://www.amazon.in/dp/TESTASIN1', india_affiliate_network: 'Amazon Associates',
      india_tracking_id: '', india_cta_label: 'Explore India', india_active: true,
      us_affiliate_url: '',
      seo_title: '', seo_description: '', canonical_url: '', focus_keyword: '',
    };
    const res = await callHandler(
      adminIdRoute, 'PUT', makeRequest(`/api/admin/products/${createdId}`, 'PUT', editorBody),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(200);

    const read = await callHandler(
      adminIdRoute, 'GET', makeRequest(`/api/admin/products/${createdId}`, 'GET'),
      { params: Promise.resolve({ id: createdId }) },
    );
    const data = await read.json();
    expect(data.product.global_affiliate_url).toBe('https://www.amazon.in/dp/TESTASIN1');
    expect(data.product.benefits).toEqual(['one']);
    expect(data.product.us_affiliate_url).toBe('');
  });

  it('explicit zeros the operator types are honored (0 is data, not absence)', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(
      adminIdRoute, 'PUT', makeRequest(`/api/admin/products/${createdId}`, 'PUT', {
        current_price: 0, rating: 0, review_count: 0,
      }),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(200);
    const db = new Database(tmpDbPath);
    const row = db.prepare('SELECT current_price, rating, review_count FROM products WHERE id = ?').get(createdId) as any;
    expect(row.current_price).toBe(0);
    expect(row.rating).toBe(0);
    expect(row.review_count).toBe(0);
    db.close();
  });

  it('missing name returns a per-field 400 message, not a generic error', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', { name: '' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field_errors['name']).toBe('Product name is required');
  });

  it('non-numeric rating returns a per-field 400 message', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', {
      name: 'Bad Rating Product', rating: 'abc',
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field_errors['rating']).toBe('Rating must be a number between 0 and 5');
  });

  it('stale brand/category reference returns a pick-from-the-list message, not a FOREIGN KEY 500', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', {
      name: 'Bad Ref Product', brand_id: 'brand-does-not-exist',
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field_errors['brand_id']).toBe('Selected brand does not exist — choose a brand from the list');
  });

  it('duplicate slug returns a per-field 400 message', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', {
      name: 'Another QA Flow Product', slug: 'qa-flow-product',
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field_errors['slug']).toContain('already uses this URL slug');
  });

  it('published product read through the PUBLIC /api/products/[id] never exposes commercial fields', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', {
      name: 'Public Projection Probe',
      status: 'published',
      current_price: 19.99,
      rating: 4.5,
      brand_id: 'b1',
      category_id: 'c1',
      primary_image: '/img/probe.jpg',
      short_description: 'Probe for the public projection.',
      why_we_recommend: 'Because it probes the projection.',
      seo_title: 'Public Projection Probe — Alaya Insider',
      seo_description: 'A probe product verifying the public projection strips commercial fields.',
      global_active: true,
      global_affiliate_url: 'https://www.amazon.in/dp/ASINPROBE1',
    }));
    expect(res.status).toBe(201);
    const { id, slug } = await res.json();

    holder.auth = null; // unauthenticated public read
    const pub = await callHandler(
      publicIdRoute, 'GET', makeRequest(`/api/products/${slug}`, 'GET'),
      { params: Promise.resolve({ id: slug }) },
    );
    expect(pub.status).toBe(200);
    const data = await pub.json();
    expect(data.product.slug).toBe(slug);
    for (const f of ['current_price', 'previous_price', 'rating', 'review_count', 'currency', 'sku']) {
      expect(f in data.product).toBe(false);
    }
  });

  it('create-as-published without required fields returns 422 blockers, never a silent publish', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', {
      name: 'Instant Publish Probe', status: 'published',
    }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.blockers).toContain('Primary image is required');
  });

  it('create-as-published with every required field succeeds (Add-Product → Publish works)', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(adminListRoute, 'POST', makeRequest('/api/admin/products', 'POST', {
      name: 'Full Publish Product',
      status: 'published',
      brand_id: 'b1',
      category_id: 'c1',
      primary_image: '/img/qa.jpg',
      short_description: 'Complete from day one.',
      why_we_recommend: 'Because it is complete.',
      seo_title: 'Full Publish Product — Alaya Insider',
      seo_description: 'A product published in one pass through the admin flow test.',
      global_active: true,
      global_affiliate_url: 'https://www.amazon.in/dp/ASINQATEST',
    }));
    expect(res.status).toBe(201);
  });

  it('explicit null CLEARS a commercial field via PUT while absent keeps the stored value', async () => {
    holder.auth = `Bearer ${adminToken}`;
    // The zeros test set current_price to 0; an explicit null must clear it.
    const res = await callHandler(
      adminIdRoute, 'PUT', makeRequest(`/api/admin/products/${createdId}`, 'PUT', { current_price: null }),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(200);
    const db = new Database(tmpDbPath);
    const row = db.prepare('SELECT current_price, rating FROM products WHERE id = ?').get(createdId) as any;
    expect(row.current_price).toBeNull();
    expect(row.rating).toBe(0); // absent in this PUT → untouched
    db.close();
  });

  it('public /api/products list projection strips commercial fields on every row', async () => {
    holder.auth = null;
    const publicListRoute = await import('@/app/api/products/route');
    const res = await callHandler(publicListRoute, 'GET', makeRequest('/api/products?limit=50', 'GET'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.products.length).toBeGreaterThan(0);
    for (const p of data.products) {
      for (const f of ['current_price', 'previous_price', 'rating', 'review_count', 'currency', 'sku']) {
        expect(f in p).toBe(false);
      }
    }
  });

  it('admin DELETE archives, and a deleted product 404s on the admin read', async () => {
    holder.auth = `Bearer ${adminToken}`;
    const res = await callHandler(
      adminIdRoute, 'DELETE', makeRequest(`/api/admin/products/${createdId}`, 'DELETE'),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(200);

    const read = await callHandler(
      adminIdRoute, 'GET', makeRequest(`/api/admin/products/${createdId}`, 'GET'),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(read.status).toBe(404);
  });
});

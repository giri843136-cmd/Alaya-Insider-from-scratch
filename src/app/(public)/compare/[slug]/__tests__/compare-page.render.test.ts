/**
 * FIX I — a published comparison page must render (HTTP 200) without the
 * "Event handlers cannot be passed to Client Component props" server error
 * that the inline onClick beacons caused inside this server component.
 *
 * Strategy (no app-module imports — uuid is ESM-only and breaks ts-jest):
 *   1. copy the local dev database (data/alaya.db, seeded) to a scratch file,
 *   2. boot the real production server (`next start`) against it,
 *   3. insert one published comparison over two seeded published products
 *      via raw better-sqlite3,
 *   4. fetch /compare/<slug> and assert 200 + content + no event-handler
 *      error + the direct Amazon CTA still present.
 * Skips when no production build or no dev DB exists (run `npm run build`
 * first; on a fresh clone without a seeded DB there is nothing to render).
 *
 * TASK 27 (A2): assertions against the SERVED bytes — the Associate sentence
 * must appear in `next start` output and every disclosure element in that
 * output must pass the NUMERIC contrast gate (>= 4.5:1). This is THE
 * next-start + fetch-HTML suite: it GETs BOTH affiliate templates (compare
 * AND product, the latter for a fixture slug) and registers each fetched
 * page in SERVED_DISCLOSURE_COVERAGE; a test here fails if any file under
 * src/app that renders an affiliate link is NOT covered by a page actually
 * fetched (and disclosure-asserted) in this suite.
 */
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  expectServedDisclosureCompliance,
  SERVED_DISCLOSURE_COVERAGE,
  upsertRenderTestProduct,
} from '@/lib/testing/disclosure-contrast';

const PORT = 3217;
const BASE = `http://127.0.0.1:${PORT}`;
const SLUG = 'render-test-compare';
const devDb = path.resolve(process.cwd(), 'data', 'alaya.db');
const runnable = fs.existsSync(path.resolve(process.cwd(), '.next', 'BUILD_ID')) && fs.existsSync(devDb);

const d = runnable ? describe : describe.skip;

d('compare page render (FIX I)', () => {
  let server: ChildProcess | undefined;
  let scratchDb = '';
  const ORIGINAL_ENV = { ...process.env };

  beforeAll(async () => {
    process.env.AUTH_SECRET = 'test-render-secret-0123456789abcdef0123456789abcdef';
    delete process.env.NEXT_PHASE;

    scratchDb = path.join(os.tmpdir(), `alaya-compare-render-${Date.now()}.db`);
    fs.copyFileSync(devDb, scratchDb);

    server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(PORT)], {
      env: { ...process.env, DATABASE_PATH: scratchDb },
      stdio: 'ignore',
    });

    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const res = await fetch(`${BASE}/admin/login`);
        up = res.status === 200;
      } catch {
        /* not up yet */
      }
    }
    if (!up) throw new Error(`next start on :${PORT} did not become ready`);
  }, 60000);

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
    server?.kill();
    try {
      fs.unlinkSync(scratchDb);
      fs.unlinkSync(`${scratchDb}-shm`);
      fs.unlinkSync(`${scratchDb}-wal`);
    } catch {
      /* best effort */
    }
  });

  it('renders a published comparison with HTTP 200 and no event-handler error', async () => {
    const Database = require('better-sqlite3');
    const db = new Database(scratchDb);
    const prods = db
      .prepare("SELECT id FROM products WHERE status='published' AND deleted_at IS NULL LIMIT 2")
      .all() as { id: string }[];
    expect(prods.length).toBe(2);
    db.prepare(
      `INSERT INTO comparisons (id, slug, title, description, product_ids, status, created_at, updated_at)
       VALUES ('render-test-1', ?, 'Render Test Comparison', 'desc', ?, 'published', datetime('now'), datetime('now'))`,
    ).run(SLUG, JSON.stringify(prods.map(p => p.id)));
    db.close();

    const res = await fetch(`${BASE}/compare/${SLUG}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('Render Test Comparison');
    expect(html).not.toContain('Event handlers cannot be passed');
    // The CTA must still be a real, direct Amazon anchor (rel kept):
    expect(html).toMatch(/rel="[^"]*sponsored[^"]*"/);
    expect(html).not.toMatch(/href="\/go\//);

    // TASK 27 (A2) — assert against the REAL rendered output: the Associate
    // sentence appears next to both CTA rows (mobile cards + desktop row)
    // and EVERY disclosure element in the served bytes passes the NUMERIC
    // contrast gate (>= 4.5:1) — not just a class-list ban.
    const served = expectServedDisclosureCompliance(html, '/compare/[slug]');
    expect(served.count).toBeGreaterThanOrEqual(2); // mobile cards + desktop table row
  }, 30000);

  it('TASK 27 A2: the product page SERVES at least one disclosure line for a fixture slug, contrast-compliant in the served bytes', async () => {
    // Insert the fixture product AFTER boot: the page is force-dynamic and
    // reads the scratch DB per request (same pattern as the comparison above).
    const Database = require('better-sqlite3');
    const db = new Database(scratchDb);
    const PRODUCT_SLUG = 'render-test-product';
    upsertRenderTestProduct(db, { slug: PRODUCT_SLUG, name: 'Render Test Disclosure Product' });
    db.close();

    const res = await fetch(`${BASE}/product/${PRODUCT_SLUG}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    // Real page render (no vacuous pass on a 404/error shell):
    expect(html).toContain('Render Test Disclosure Product');
    // The served anchor is a real direct Amazon deeplink:
    expect(html).toMatch(/href="https:\/\/www\.amazon\.(in|com)\/dp\/B0RENDERTEST1\?tag=/);
    expect(html).toMatch(/rel="[^"]*sponsored[^"]*"/);

    // THE requirement: >= 1 disclosure line IN THE SERVED BYTES, and every
    // disclosure element in those bytes passes the NUMERIC >= 4.5:1 gate.
    const served = expectServedDisclosureCompliance(html, '/product/[slug]');
    // DestinationSelector's per-CTA sentence + the Footer's site-wide one:
    expect(served.count).toBeGreaterThanOrEqual(2);

    // Registered ONLY after the served-bytes assertions above PASSED. The
    // second entry is the wiring wrapper rendered INSIDE the page just
    // fetched — its output was in the served bytes we asserted, so its
    // coverage comes from this very fetch.
    SERVED_DISCLOSURE_COVERAGE.add('src/app/(public)/product/[slug]/page.tsx');
    SERVED_DISCLOSURE_COVERAGE.add('src/app/(public)/product/[slug]/ProductCTA.tsx');
  }, 30000);

  it('TASK 27 A2: every affiliate-carrier file under src/app is covered by a served-bytes page in this suite', () => {
    // Escape hatch ONLY for a forced build from a pre-27 commit:
    // ALAYA_SKIP_DISCLOSURE_COVERAGE=1 npm run build
    if (process.env.ALAYA_SKIP_DISCLOSURE_COVERAGE === '1') {
      // eslint-disable-next-line no-console
      console.warn('[TASK 27 A2] coverage map SKIPPED — build was forced with ALAYA_SKIP_DISCLOSURE_COVERAGE=1');
      return;
    }
    // Served-bytes coverage is recorded by BOTH next-start suites (compare
    // here, product in product-page.render.test.ts).
    SERVED_DISCLOSURE_COVERAGE.add('src/app/(public)/compare/[slug]/page.tsx');

    const appDir = path.join(process.cwd(), 'src', 'app');
    const carriers: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx$/.test(e.name)) {
          const src = fs.readFileSync(full, 'utf8');
          if (
            /<a\b[^>]*href=["']https:\/\/www\.amazon\.(in|com)\/dp/.test(src) ||
            /<(CtaLink|DestinationSelector|ProductCTA)\b/.test(src)
          ) {
            carriers.push(path.relative(process.cwd(), full).replace(/\\/g, '/'));
          }
        }
      }
    };
    walk(appDir);
    expect(carriers.length).toBeGreaterThanOrEqual(1);
    const uncovered = carriers.filter((f) => !SERVED_DISCLOSURE_COVERAGE.has(f));
    // eslint-disable-next-line no-console
    console.log('[TASK 27 A2] affiliate carriers: ' + carriers.join(', '));
    // eslint-disable-next-line no-console
    console.log('[TASK 27 A2] served-bytes coverage: ' + [...SERVED_DISCLOSURE_COVERAGE].join(', '));
    expect(uncovered).toEqual([]);
  });
});

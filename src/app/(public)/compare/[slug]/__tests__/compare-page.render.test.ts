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
 */
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

    // TASK 27 — assert against the REAL rendered output: the Associate
    // sentence appears next to both CTA rows and no disclosure element
    // carries the banned low-contrast classes.
    const disclosureCount = (html.match(/As an Amazon Associate I earn from qualifying purchases\./g) || []).length;
    expect(disclosureCount).toBeGreaterThanOrEqual(2); // mobile cards + desktop table row
    const disclosureClasses = [
      ...html.matchAll(/class="([^"]*)"[^>]*>As an Amazon Associate I earn from qualifying purchases\./g),
    ].map((m) => m[1]);
    expect(disclosureClasses.length).toBeGreaterThanOrEqual(2);
    for (const cls of disclosureClasses) {
      expect(cls).toContain('text-[14px]');
      expect(cls).toContain('font-medium');
      expect(cls).not.toContain('text-white/25');
      expect(cls).not.toContain('text-[10px]');
      expect(cls).not.toContain('text-[11px]');
    }
  }, 30000);
});

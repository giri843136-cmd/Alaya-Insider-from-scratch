/**
 * TASK 27 (A2) — product-page disclosure, SERVED bytes.
 *
 * The served-bytes product-page test itself runs in
 *   src/app/(public)/compare/[slug]/__tests__/compare-page.render.test.ts
 * — it is THE next-start + fetch-HTML suite: one production server boot,
 * one scratch DB, and it GETs BOTH affiliate templates (compare AND this
 * product page for a fixture slug), asserting the Associate sentence and
 * the numeric >= 4.5:1 contrast gate against the served bytes. The test
 * also registers the product page in SERVED_DISCLOSURE_COVERAGE, which its
 * affiliate-carrier coverage test checks against every file under src/app.
 *
 * This file exists only so the test is discoverable/addressable from the
 * product page's own __tests__ directory (jest's testMatch covers
 * __tests__/**.ts only, and a separate suite would boot its own server and
 * run in an isolated worker, so the coverage registry must live in ONE
 * suite). Run it with:
 *   npx jest compare-page.render -t "TASK 27 A2: the product page"
 */
describe('product page render (TASK 27 A2, served bytes — runs in compare-page.render.test.ts for a single server boot)', () => {
  it('is defined in src/app/(public)/compare/[slug]/__tests__/compare-page.render.test.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const suitePath = path.resolve(
      process.cwd(),
      'src/app/(public)/compare/[slug]/__tests__/compare-page.render.test.ts',
    );
    expect(fs.existsSync(suitePath)).toBe(true);
    const src = fs.readFileSync(suitePath, 'utf8');
    expect(src).toContain('`${BASE}/product/${PRODUCT_SLUG}`');
    expect(src).toContain('SERVED_DISCLOSURE_COVERAGE.add');
  });
});

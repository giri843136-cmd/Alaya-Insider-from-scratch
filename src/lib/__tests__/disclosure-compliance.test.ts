/**
 * TASK 27 — affiliate disclosure compliance (render-based).
 *
 * Requirement: the exact sentence "As an Amazon Associate I earn from
 * qualifying purchases." must be visible on every template that renders an
 * affiliate link. The pre-merge VIOLATION was contrast (footer
 * text-white/25 ~1.4:1, effectively invisible); Amazon requires the
 * sentence itself — per-CTA adjacency is our own stricter standard.
 *
 * This suite renders the components to real HTML (React.createElement +
 * renderToStaticMarkup — jest's testMatch is .ts-only, so no JSX here):
 *   - disclosure count >= 1 in the OUTPUT (a test that passes when the
 *     component renders nothing must not exist);
 *   - the OUTPUT must not contain the banned low-contrast utility classes
 *     on disclosure elements;
 *   - the resolved colour+size must come from the rendered markup
 *     (text-[14px] font-medium text-gray-600|text-white);
 *   - NUMERIC gate (A1): the rendered colour pair's WCAG contrast ratio
 *     is computed from the palette (tailwind.config.ts is the source of
 *     truth) and must be >= 4.5:1 — see src/lib/testing/disclosure-contrast.ts.
 *
 * Generalised coverage (do not enumerate): every file under src/app whose
 * source matches an affiliate deeplink anchor pattern is listed in the test
 * output; each matched component source must either render the sentence or
 * be a known wiring-only wrapper whose rendered child carries it. Ground
 * truth today: only product + compare pages carry deeplinks (home,
 * /products, journal, category have zero sponsored links).
 * SERVED-bytes coverage lives in the compare-page render suite and the
 * product-page render suite (real `next start` output, fixture products) —
 * an affiliate-carrier file with NO rendered-page coverage in those suites
 * fails that suite's coverage map.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SENTENCE,
  SURFACE_ACCENT,
  SURFACE_WHITE,
  expectContrastAtLeast45,
  type Rgb,
} from '@/lib/testing/disclosure-contrast';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const AFFILIATE_ANCHOR_RE = /<a\b[^>]*href=["']https:\/\/www\.amazon\.(in|com)\/dp/;

function countIn(html: string): number {
  return (html.match(new RegExp(SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

function disclosureElements(html: string): { classes: string; text: string }[] {
  // <p|span|div ... class="...">SENTENCE</p|span|div>
  const out: { classes: string; text: string }[] = [];
  const re = /<(p|span|div)\b([^>]*)>([^<]*As an Amazon Associate I earn from qualifying purchases\.)([^<]*)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrMatch = m[2].match(/class="([^"]*)"/);
    out.push({ classes: attrMatch ? attrMatch[1] : '', text: (m[3] + (m[4] || '')).trim() });
  }
  return out;
}

function expectCompliant(el: { classes: string; text: string }, surface: Rgb) {
  expect(el.text).toContain(SENTENCE);
  expect(el.classes).toContain('text-[14px]');
  expect(el.classes).toContain('font-medium');
  expect(el.classes).toMatch(/text-(gray-600|white)(?![\w/-])/);
  // NUMERIC gate (TASK 27) FIRST: the pair the browser paints must clear
  // 4.5:1 — this is the real invariant; the class bans below are tripwires.
  expectContrastAtLeast45(el.classes, surface, 'component render');
  // banned low-contrast utilities must not be on the disclosure element
  expect(el.classes).not.toContain('text-white/25');
  expect(el.classes).not.toContain('text-white/30');
  expect(el.classes).not.toContain('text-[10px]');
  expect(el.classes).not.toContain('text-[11px]');
}

describe('TASK 27: disclosure compliance in RENDERED output', () => {
  it('Footer renders the sentence >=1x, compliant, with no banned classes anywhere on it', () => {
    const Footer = require('@/components/public/Footer').default;
    const html = renderToStaticMarkup(React.createElement(Footer));
    expect(countIn(html)).toBeGreaterThanOrEqual(1);
    const els = disclosureElements(html);
    expect(els.length).toBeGreaterThanOrEqual(1);
    for (const el of els) expectCompliant(el, SURFACE_ACCENT); // footer bg is bg-accent
  });

  it('DestinationSelector (product-page CTA) renders the sentence >=1x, compliant', () => {
    const DestinationSelector = require('@/components/public/DestinationSelector').default;
    const product = {
      id: 'p1',
      india_active: 1,
      amazon_in_url: 'https://www.amazon.in/dp/B0INASIN01?tag=alayainsider-21',
      amazon_us_url: 'https://www.amazon.com/dp/B0USASIN01?tag=alayainsider-20',
      live_store: 'in',
    };
    const html = renderToStaticMarkup(React.createElement(DestinationSelector, { product }));
    // the component actually rendered its affiliate CTA (no vacuous pass)
    expect(html).toMatch(/href="https:\/\/www\.amazon\.(in|com)\/dp/);
    expect(countIn(html)).toBeGreaterThanOrEqual(1);
    const els = disclosureElements(html);
    expect(els.length).toBeGreaterThanOrEqual(1);
    for (const el of els) expectCompliant(el, SURFACE_WHITE); // product page surface is white
  });

  it('PaidLinkTag stays a per-CTA label but never carries the Associate sentence', () => {
    const PaidLinkTag = require('@/components/public/PaidLinkTag').default;
    const html = renderToStaticMarkup(React.createElement(PaidLinkTag));
    expect(html).toContain('(paid link)');
    expect(countIn(html)).toBe(0);
  });

  it('CtaLink renders a direct sponsored anchor (beacon wired, no /go/, no sentence of its own)', () => {
    const CtaLink = require('@/components/public/CtaLink').default;
    const html = renderToStaticMarkup(
      React.createElement(
        CtaLink,
        { href: 'https://www.amazon.in/dp/B0INASIN01?tag=alayainsider-21', productId: 'p1', destinationType: 'india', store: 'in', className: 'x' },
        'Check Price',
      ),
    );
    expect(html).toMatch(/rel="[^"]*sponsored[^"]*"/);
    expect(html).toMatch(/href="https:\/\/www\.amazon\.in\/dp\/B0INASIN01\?tag=alayainsider-21"/);
    expect(html).not.toContain('/go/');
    expect(countIn(html)).toBe(0); // sentence lives adjacent in the template, not inside the anchor
  });

  it('GENERALISED COVERAGE: affiliate-anchor files under src/app, with disclosure present or a wiring explanation', () => {
    const appDir = path.join(root, 'src', 'app');
    const matched: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx$/.test(e.name)) {
          const src = fs.readFileSync(full, 'utf8');
          const literal = AFFILIATE_ANCHOR_RE.test(src);
          const carrier = /<(CtaLink|DestinationSelector|ProductCTA)\b/.test(src);
          if (literal || carrier) matched.push(`${path.relative(root, full)}  [${literal ? 'literal anchor' : 'affiliate carrier'}]`);
        }
      }
    };
    walk(appDir);

    // Ground truth (logged for the reviewer — adjust only with evidence):
    // home, /products, journal and category pages have zero sponsored links.
    const rel = (s: string) => s.split('  ')[0].replace(/\\/g, '/');
    const expected = new Set([
      'src/app/(public)/product/[slug]/page.tsx', // carrier: ProductCTA (sentence inside DestinationSelector)
      'src/app/(public)/product/[slug]/ProductCTA.tsx', // wiring-only wrapper
      'src/app/(public)/compare/[slug]/page.tsx', // literal CtaLink rows + adjacent sentence
    ]);
    // eslint-disable-next-line no-console
    console.log('[TASK 27 coverage] files rendering affiliate links:\n  ' + matched.join('\n  '));
    expect(new Set(matched.map(rel))).toEqual(expected);

    // Each matched file: either its own source renders the sentence, or it
    // wires a component proven above to render it.
    const selectorSrc = read('src/components/public/DestinationSelector.tsx');
    const compareSrc = read('src/app/(public)/compare/[slug]/page.tsx');
    const productSrc = read('src/app/(public)/product/[slug]/page.tsx');
    expect(compareSrc).toContain(SENTENCE);
    expect(selectorSrc).toContain(SENTENCE);
    expect(productSrc).toContain('<ProductCTA');
  });

  it('rendered size/colour resolve from markup: 14px + font-medium + compliant colour + numeric >=4.5:1 on EVERY disclosure element in all rendered components', () => {
    const Footer = require('@/components/public/Footer').default;
    const DestinationSelector = require('@/components/public/DestinationSelector').default;
    const product = {
      id: 'p1', india_active: 1,
      amazon_in_url: 'https://www.amazon.in/dp/B0INASIN01?tag=alayainsider-21',
      live_store: 'in',
    };
    const htmls = [
      renderToStaticMarkup(React.createElement(Footer)),
      renderToStaticMarkup(React.createElement(DestinationSelector, { product })),
    ];
    const surfaces: Rgb[] = [SURFACE_ACCENT, SURFACE_WHITE];
    for (const [i, html] of htmls.entries()) {
      const els = disclosureElements(html);
      expect(els.length).toBeGreaterThanOrEqual(1);
      for (const el of els) {
        // resolved colour + size come from the rendered class attribute
        expect(el.classes).toMatch(/text-\[14px\]/);
        expect(el.classes).toMatch(/text-(gray-600|white)(?![\w/-])/);
        expect(el.classes).not.toMatch(/text-white\/\d/); // no alpha-dimmed white anywhere on it
        // numeric gate on the template's real surface (footer first, selector second)
        expectContrastAtLeast45(el.classes, surfaces[i], i === 0 ? 'Footer' : 'DestinationSelector');
      }
    }
  });
});

/**
 * TASK 27 — numeric contrast gate for affiliate disclosures (shared).
 *
 * A class-list tripwire is only a proxy: a new dimming utility or a palette
 * edit could pass a class ban while the sentence stays illegible. The
 * requirement is NUMERIC — resolve the rendered foreground/background pair
 * to RGB and require the WCAG 2.x relative-luminance contrast ratio to be
 * at least 4.5:1. Palette values are read from tailwind.config.ts (the
 * source of truth), never copied into the tests.
 *
 * Not a *.test.ts file and not under __tests__: this module holds no tests,
 * it is imported by the disclosure-compliance and compare-page render suites.
 */
import fs from 'fs';
import path from 'path';

export const SENTENCE = 'As an Amazon Associate I earn from qualifying purchases.';
const SENTENCE_RE = SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** WCAG 2.x relative luminance (sRGB, simplified threshold form). */
export function relativeLuminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Alpha-dimmed foregrounds (text-white/25) RENDER as a blend over the
 * surface — resolve the pair the browser actually paints.
 */
export function blend(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as Rgb;
}

// Tailwind v3 built-in gray ramp (NOT overridden in tailwind.config.ts).
const GRAY_RAMP: Record<string, string> = {
  '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af',
  '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827',
};

const twColors = (() => {
  const cfgPath = path.join(process.cwd(), 'tailwind.config.ts');
  const cfg = fs.existsSync(cfgPath) ? require(cfgPath) : {};
  return ((cfg.default ?? cfg).theme?.extend?.colors ?? {}) as Record<string, any>;
})();

/** bg-accent: the footer surface (#2d2b3d). */
export const SURFACE_ACCENT: Rgb = parseHex(twColors.accent.DEFAULT);
/** The white page surface the product/compare templates render on. */
export const SURFACE_WHITE: Rgb = [255, 255, 255];

/**
 * Resolve a disclosure element's foreground colour class to the RGB the
 * browser paints, blended over the given surface. Throws on unresolvable
 * classes so a rename can never silently bypass the gate.
 */
export function renderedForeground(classes: string, surface: Rgb): { rgb: Rgb; token: string } {
  const tokens = classes.split(/\s+/).filter(Boolean);
  const token = tokens.find((t) =>
    /^text-(white|black|gray-\d+|accent|sage|plum|warm|ivory)(?:-[\w]+)?(?:\/\d{1,3})?$/.test(t),
  );
  if (!token) throw new Error(`no resolvable foreground colour class on disclosure element: "${classes}"`);
  const [base, alphaStr] = token.split('/');
  const alpha = alphaStr === undefined ? 1 : Number(alphaStr) / 100;
  let solid: Rgb | null = null;
  if (base === 'text-white') solid = [255, 255, 255];
  else if (base === 'text-black') solid = [0, 0, 0];
  else if (/^text-gray-\d+$/.test(base)) {
    const hex = GRAY_RAMP[base.slice(10)];
    if (hex) solid = parseHex(hex);
  } else {
    for (const name of ['accent', 'sage', 'plum', 'warm', 'ivory'] as const) {
      if (base === `text-${name}`) solid = parseHex(twColors[name].DEFAULT ?? twColors[name]);
      else if (base.startsWith(`text-${name}-`)) {
        const shade = twColors[name]?.[base.slice(name.length + 6)];
        if (typeof shade === 'string') solid = parseHex(shade);
      }
    }
  }
  if (!solid) throw new Error(`foreground class "${token}" is not mapped in the contrast resolver`);
  return { rgb: blend(solid, alpha, surface), token };
}

/**
 * THE gate: compute the rendered colour pair's ratio and require >= 4.5:1.
 * Returns the computed ratio so suites can log final gate numbers.
 */
export function expectContrastAtLeast45(classes: string, surface: Rgb, label: string): number {
  const { rgb, token } = renderedForeground(classes, surface);
  const ratio = contrastRatio(rgb, surface);
  // eslint-disable-next-line no-console
  console.log(`[TASK 27 contrast] ${label}: ${token} -> ${ratio.toFixed(2)}:1 (required >= 4.5:1)`);
  if (!(ratio >= 4.5)) {
    throw new Error(
      `disclosure contrast FAILED for ${label}: ${token} computes ${ratio.toFixed(2)}:1 on the rendered surface — WCAG AA normal-text floor is 4.5:1`,
    );
  }
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  return ratio;
}

/** class attribute of every disclosure element in SERVED html. */
export function servedDisclosureClasses(html: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`class="([^"]*)"[^>]*>[^<]*${SENTENCE_RE}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/** number of disclosure sentences in the given html (served or rendered). */
export function countSentences(html: string): number {
  return (html.match(new RegExp(SENTENCE_RE, 'g')) || []).length;
}

/**
 * Served-bytes gate: require >=1 disclosure line, then numeric-contrast every
 * disclosure element. White-text disclosures render on the accent footer;
 * gray-600 ones on the white page surface (true for every template today).
 */
export function expectServedDisclosureCompliance(html: string, label: string): { count: number; ratios: number[] } {
  const count = countSentences(html);
  expect(count).toBeGreaterThanOrEqual(1);
  const classes = servedDisclosureClasses(html);
  expect(classes.length).toBeGreaterThanOrEqual(1);
  const ratios: number[] = [];
  for (const cls of classes) {
    const onAccent = /(^|\s)text-white(\/\d+)?(\s|$)/.test(cls);
    ratios.push(expectContrastAtLeast45(cls, onAccent ? SURFACE_ACCENT : SURFACE_WHITE, `${label} (served bytes)`));
  }
  return { count, ratios };
}

// ── A2: affiliate-carrier served-bytes coverage registry + fixtures ───────

/**
 * Every file under src/app that renders an affiliate link must appear in
 * this set — registered ONLY by a next-start suite that actually GETs a
 * page rendering that file and checks the disclosure in the served bytes.
 * The carrier-coverage test in the compare-page suite fails on any
 * src/app file matching the affiliate-link patterns that is absent here.
 */
export const SERVED_DISCLOSURE_COVERAGE = new Set<string>();

/**
 * Insert or update a published, affiliate-active fixture product.
 * Only PERSISTED fields are set (india_affiliate_url / us_affiliate_url);
 * amazon_in_url / amazon_us_url do not exist as columns — the page's
 * enricher (amazon-price.ts) computes those direct tagged anchors from the
 * stored affiliate URLs at request time.
 */
export function upsertRenderTestProduct(db: any, { slug, name }: { slug: string; name: string }): string {
  const indiaUrl = 'https://www.amazon.in/dp/B0RENDERTEST1?tag=alayainsider-21';
  const usUrl = 'https://www.amazon.com/dp/B0RENDERTEST1?tag=alayainsider-20';
  const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug) as { id: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE products SET name = ?, status = 'published', deleted_at = NULL,
        india_active = 1, global_active = 0,
        india_affiliate_url = ?, us_affiliate_url = ?
       WHERE id = ?`,
    ).run(name, indiaUrl, usUrl, existing.id);
    return existing.id;
  }
  const id = 'render-test-product-1';
  db.prepare(
    `INSERT INTO products (id, name, slug, status, india_active, global_active,
        india_affiliate_url, us_affiliate_url,
        benefits, pros, cons, tags, specifications, gallery_images)
     VALUES (?, ?, ?, 'published', 1, 0, ?, ?, '[]', '[]', '[]', '[]', '{}', '[]')`,
  ).run(id, name, slug, indiaUrl, usUrl);
  return id;
}

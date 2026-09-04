#!/usr/bin/env node
/**
 * Alaya Insider — fix invalid amazon.com (US) product links.
 *
 * Background: every product's "US ASIN" was seeded by reusing its amazon.in
 * ASIN. Amazon catalogs are per-marketplace, so on amazon.com 18/20 of those
 * ASINs return HTTP 404 and 2/20 resolve to a DIFFERENT product. This script
 * applies the verified replacements found on 2026-09-04 (each ASIN confirmed
 * live on amazon.com: HTTP 200 + matching product title).
 *
 *   node scripts/fix-us-links.js            # dry run — shows what would change
 *   node scripts/fix-us-links.js --apply    # backup + apply
 *
 * What it does:
 *   - 16 products: writes the real amazon.com URL into us_affiliate_url
 *     (https://www.amazon.com/dp/<ASIN>?tag=alayainsider-20). The US field
 *     takes precedence over the legacy .com link in src/lib/amazon-price.ts.
 *   - 4 products with NO trustworthy amazon.com listing (Muji cotton sheets,
 *     travel organizer set, LED desk lamp, ultrasonic humidifier — MUJI exited
 *     the US market): clears us_affiliate_url and points the legacy
 *     affiliate_url / global_affiliate_url .com fallbacks at the working
 *     amazon.in link, so international visitors fall back to the .in link
 *     instead of a dead .com page.
 *
 * Safe by default: --apply is required to write. Before writing it copies the
 * database to data/backups/alaya-uslinks-<timestamp>.db. Idempotent — re-run
 * reports nothing to do. Uses DATABASE_PATH (default ./data/alaya.db), same as
 * the app.
 */

const fs = require('fs');
const path = require('path');

// slug → amazon.com ASIN (verified live 2026-09-04)
const FIXES = {
  'muji-aroma-diffuser': 'B09361272Z',          // MUJI MJ-UAD1 Ultrasonic Aroma Diffuser
  'aesop-resurrection-hand-wash': 'B01MDVOM5S', // Resurrection Aromatique Hand Wash 500ml
  'le-creuset-dutch-oven': 'B00VWMFLQI',        // Signature Round Dutch Oven 5.5qt Flame
  'bang-olufsen-beoplay-h95': 'B0916JNV9T',     // Beoplay H95 Black Anthracite
  'away-carry-on': 'B0DLJ5CDB2',                // Away The Carry-On 22"
  'aesop-parsley-seed-cleanser': 'B008E55738',  // Parsley Seed Facial Cleanser 200ml
  'le-creuset-stoneware-mug': 'B003F24D1M',     // Vancouver Mug 14oz Cerise
  'bang-olufsen-beosound-a1': 'B085R7TSN6',     // Beosound A1 (2nd Gen) Anthracite
  'aesop-reverence-hand-balm': 'B00K0C6OUI',    // Reverence Hand Balm 75ml
  'le-creuset-skillet': 'B00B4UOKM4',           // Signature Round Skillet 10.25" Flame
  'away-everywhere-bag': 'B0GS6Z1Y3W',          // Away The Everywhere Bag
  'bang-olufsen-beoplay-ex': 'B09VLHYQMV',      // Beoplay EX Black Anthracite
  'aesop-geranium-body-cleanser': 'B00BJ2BUIO', // Geranium Leaf Body Cleanser 500ml
  'muji-stainless-steel-tumbler': 'B0753G1V5Z', // Muji Stainless Steel Tumbler 300ml
  'le-creuset-salt-pepper-mills': 'B00U00JMSQ', // Salt & Pepper Mill Set 8" Black & White
  'away-toiletry-bag': 'B0FR9ZR4MW',            // Away Small Toiletry Bag
};

// No trustworthy amazon.com listing → neutralize so visitors fall back to .in
const NEUTRALIZE = [
  'muji-cotton-bed-sheets',     // MUJI US sells only JP-size fitted sheets
  'muji-travel-organizer-set',  // only single hanging cases exist, not the set
  'muji-led-desk-lamp',         // closest is the LED Mobile Lamp — different product
  'muji-ultrasonic-humidifier', // only aroma diffusers exist on amazon.com
];

const US_TAG = 'alayainsider-20';
const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/alaya.db');
const apply = process.argv.includes('--apply');

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  console.error('Run from the app root (server: ~/Alaya-Insider) or set DATABASE_PATH.');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);
const usUrl = asin => `https://www.amazon.com/dp/${asin}?tag=${US_TAG}`;
const asinOf = url => (typeof url === 'string' ? (url.match(/dp\/([A-Z0-9]{10})/) || [])[1] : null);

// Current effective US ASIN, mirroring productUsAsin() precedence
function currentUsAsin(row) {
  for (const url of [row.us_affiliate_url, row.affiliate_url, row.global_affiliate_url]) {
    if (typeof url === 'string' && url.includes('.amazon.com')) {
      const a = asinOf(url);
      if (a) return a;
    }
  }
  return null;
}

const rows = db.prepare(
  `SELECT slug, name, india_affiliate_url, affiliate_url, global_affiliate_url, us_affiliate_url
   FROM products WHERE deleted_at IS NULL`
).all();
const bySlug = new Map(rows.map(r => [r.slug, r]));

const plan = []; // { slug, name, action, current, target }
for (const [slug, targetAsin] of Object.entries(FIXES)) {
  const row = bySlug.get(slug);
  if (!row) { console.warn(`skip: slug not found — ${slug}`); continue; }
  const cur = currentUsAsin(row);
  const want = usUrl(targetAsin);
  if (row.us_affiliate_url === want) {
    plan.push({ slug, name: row.name, action: 'ok (already set)', current: cur, target: targetAsin });
  } else {
    plan.push({ slug, name: row.name, action: 'set US URL', current: cur, target: targetAsin });
  }
}
for (const slug of NEUTRALIZE) {
  const row = bySlug.get(slug);
  if (!row) { console.warn(`skip: slug not found — ${slug}`); continue; }
  const cur = currentUsAsin(row);
  const legacyIsCom = (row.affiliate_url || '').includes('.amazon.com')
    || (row.global_affiliate_url || '').includes('.amazon.com');
  if (!cur && !legacyIsCom) {
    plan.push({ slug, name: row.name, action: 'ok (already neutralized)', current: null, target: '— (in fallback)' });
  } else {
    plan.push({ slug, name: row.name, action: 'neutralize → .in fallback', current: cur, target: '— (in fallback)' });
  }
}

console.log(`DB: ${dbPath}   mode: ${apply ? 'APPLY' : 'DRY RUN (use --apply to write)'}\n`);
let changed = 0;
for (const p of plan) {
  const flag = p.action.startsWith('ok') ? '  ' : '→ ';
  console.log(`${flag}${p.slug.padEnd(34)} ${String(p.current || '—').padEnd(11)} ${p.action}${p.action === 'set US URL' ? ' → ' + p.target : ''}`);
  if (!p.action.startsWith('ok')) changed++;
}
console.log(`\n${plan.length} products checked, ${changed} to change.`);

if (!apply) {
  console.log('Dry run only — nothing written. Re-run with --apply to execute.');
  process.exit(changed ? 0 : 0);
}

if (changed === 0) { console.log('Nothing to do.'); process.exit(0); }

// Backup before writing
const backupsDir = path.resolve(process.cwd(), './data/backups');
fs.mkdirSync(backupsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
const backupFile = path.join(backupsDir, `alaya-uslinks-${stamp}.db`);
fs.copyFileSync(dbPath, backupFile);
console.log(`Backup written: ${backupFile}`);

const tx = db.transaction(() => {
  const setUs = db.prepare(`UPDATE products SET us_affiliate_url = ?, updated_at = datetime('now') WHERE slug = ?`);
  const neutralize = db.prepare(`
    UPDATE products
    SET us_affiliate_url = '',
        affiliate_url = CASE WHEN affiliate_url LIKE '%amazon.com%' THEN india_affiliate_url ELSE affiliate_url END,
        global_affiliate_url = CASE WHEN global_affiliate_url LIKE '%amazon.com%' THEN india_affiliate_url ELSE global_affiliate_url END,
        updated_at = datetime('now')
    WHERE slug = ?`);
  for (const p of plan) {
    if (p.action === 'set US URL') setUs.run(usUrl(FIXES[p.slug]), p.slug);
    else if (p.action === 'neutralize → .in fallback') neutralize.run(p.slug);
  }
});
tx();
console.log('Applied. Verify live with:');
console.log('  curl -s https://alayainsider.com/api/products | grep -o "amazon_us_url[^,]*" | head');
db.close();

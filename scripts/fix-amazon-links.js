#!/usr/bin/env node
/**
 * Alaya Insider — repair the product → Amazon link data (amazon.in + amazon.com).
 *
 * Audit result (2026-09-04): the seeded ASINs were never per-marketplace
 * listings — every product reused a single fabricated ASIN string. Live checks
 * against Amazon showed:
 *   - amazon.in:  19/20 ASINs return 404, 1/20 resolves to a DIFFERENT product
 *   - amazon.com: 18/20 ASINs return 404, 2/20 resolve to a DIFFERENT product
 *
 * This script writes the verified replacements found that day (every ASIN
 * confirmed live on its marketplace: HTTP 200 + matching page title).
 *
 *   node scripts/fix-amazon-links.js            # dry run — shows what would change
 *   node scripts/fix-amazon-links.js --apply    # backup + apply
 *
 * What it does:
 *   - IN_FIXES (12): writes the verified amazon.in URL into india_affiliate_url
 *   - US_FIXES (16): writes the verified amazon.com URL into us_affiliate_url
 *     (takes precedence over the legacy .com link in src/lib/amazon-price.ts)
 *   - US_NEUTRALIZE (4): products with no amazon.com listing — clears
 *     us_affiliate_url and points the legacy .com fallbacks at the .in link so
 *     international visitors never hit a dead amazon.com page.
 *   - With --unpublish-noin: takes the remaining 8 products (no genuine
 *     amazon.in listing — MUJI left the Indian market, Away's toiletry bag and
 *     Aesop's Reverence Hand Balm aren't sold there) off the live site:
 *       ARCHIVE (4)  — no listing on EITHER marketplace: set status 'archived'
 *       DRAFT   (4)  — valid .com but no .in: set status 'draft' (kept for a
 *                      future international angle)
 *
 * Safe by default: --apply is required to write. Before writing it copies the
 * database to data/backups/alaya-amazonlinks-<timestamp>.db. Idempotent.
 * Uses DATABASE_PATH (default ./data/alaya.db), same as the app.
 */

const fs = require('fs');
const path = require('path');

const US_TAG = 'alayainsider-20';
const IN_TAG = 'alayainsider-21';

// slug → verified amazon.in ASIN (live 2026-09-04)
const IN_FIXES = {
  'aesop-resurrection-hand-wash': 'B01MDVOM5S',  // Resurrection Aromatique Hand Wash 500ml
  'le-creuset-dutch-oven': 'B07MXNZNHN',         // Signature Round Dutch Oven 5.5qt Sea Salt
  'bang-olufsen-beoplay-h95': 'B09HC339ZG',      // Beoplay H95 (Chestnut); alt 3rd gen: B091TM594V
  'away-carry-on': 'B0DLJHS52R',                 // Away Carry-On Navy Blue
  'aesop-parsley-seed-cleanser': 'B008E55738',   // Parsley Seed Facial Cleanser 200ml
  'le-creuset-stoneware-mug': 'B07MP6SZ8T',      // Stoneware Mug 350ml Flint
  'bang-olufsen-beosound-a1': 'B0F3P1YSD2',      // Beosound A1 (3rd gen — successor)
  'le-creuset-skillet': 'B01N0Z8AIZ',            // Signature Iron Handle Skillet 10.25" Oyster
  'away-everywhere-bag': 'B0DLHD8WHJ',           // Away Everywhere Bag Jet Black
  'bang-olufsen-beoplay-ex': 'B09VLHYQMV',       // Beoplay EX
  'aesop-geranium-body-cleanser': 'B003NTYTO8',  // Geranium Leaf Body Cleanser 200ml
  'le-creuset-salt-pepper-mills': 'B0DWTB9Q6T',  // Salt & Pepper Mill Set 8" White
};

// slug → verified amazon.com ASIN (live 2026-09-04)
const US_FIXES = {
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

// No trustworthy amazon.com listing → neutralize so US/international falls back to .in
const US_NEUTRALIZE = [
  'muji-cotton-bed-sheets',
  'muji-travel-organizer-set',
  'muji-led-desk-lamp',
  'muji-ultrasonic-humidifier',
];

// No genuine amazon.in listing found (dead .in CTA today) → needs editorial decision.
// This script does NOT touch their india_affiliate_url.
const REVIEW_NO_IN_LISTING = [
  'muji-aroma-diffuser',        // MUJI diffusers not sold on amazon.in (aroma stone only)
  'muji-cotton-bed-sheets',     // MUJI sheets not sold on amazon.in
  'muji-travel-organizer-set',  // MUJI pouches not sold on amazon.in
  'muji-led-desk-lamp',         // MUJI lamps not sold on amazon.in
  'muji-ultrasonic-humidifier', // MUJI humidifiers not sold on amazon.in
  'muji-stainless-steel-tumbler', // MUJI tumblers not sold on amazon.in
  'away-toiletry-bag',          // Away toiletry bag not sold on amazon.in
  'aesop-reverence-hand-balm',  // Aesop balm not stocked on amazon.in (hand wash is)
];

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/alaya.db');
const apply = process.argv.includes('--apply');
const unpublish = process.argv.includes('--unpublish-noin');

// Products with no amazon.in listing and no amazon.com listing → archive.
const ARCHIVE_NO_LISTING = [
  'muji-cotton-bed-sheets',
  'muji-travel-organizer-set',
  'muji-led-desk-lamp',
  'muji-ultrasonic-humidifier',
];

// Products with a valid amazon.com listing but no amazon.in listing → draft.
const DRAFT_COM_ONLY = [
  'muji-aroma-diffuser',
  'muji-stainless-steel-tumbler',
  'away-toiletry-bag',
  'aesop-reverence-hand-balm',
];

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  console.error('Run from the app root (server: ~/Alaya-Insider) or set DATABASE_PATH.');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);
const inUrl = asin => `https://www.amazon.in/dp/${asin}?tag=${IN_TAG}`;
const usUrl = asin => `https://www.amazon.com/dp/${asin}?tag=${US_TAG}`;
const asinOf = u => (typeof u === 'string' ? (u.match(/dp\/([A-Z0-9]{10})/) || [])[1] : null);
const isCom = u => typeof u === 'string' && u.includes('.amazon.com');

// Effective US ASIN, mirroring productUsAsin() precedence
function currentUsAsin(row) {
  for (const u of [row.us_affiliate_url, row.affiliate_url, row.global_affiliate_url]) {
    if (isCom(u)) { const a = asinOf(u); if (a) return a; }
  }
  return null;
}

const rows = db.prepare(
  `SELECT slug, name, status, india_affiliate_url, affiliate_url, global_affiliate_url, us_affiliate_url, archived_at
   FROM products WHERE deleted_at IS NULL`
).all();
const bySlug = new Map(rows.map(r => [r.slug, r]));

const plan = [];
for (const [slug, asin] of Object.entries(IN_FIXES)) {
  const row = bySlug.get(slug);
  if (!row) { console.warn(`skip (not in DB): ${slug}`); continue; }
  const want = inUrl(asin);
  if (row.india_affiliate_url === want) plan.push({ slug, name: row.name, action: 'ok (in set)', cur: row.india_affiliate_url, want });
  else plan.push({ slug, name: row.name, action: 'set .in URL', cur: row.india_affiliate_url, want });
}
for (const [slug, asin] of Object.entries(US_FIXES)) {
  const row = bySlug.get(slug);
  if (!row) { console.warn(`skip (not in DB): ${slug}`); continue; }
  const cur = currentUsAsin(row);
  const want = usUrl(asin);
  if (row.us_affiliate_url === want) plan.push({ slug, name: row.name, action: 'ok (us set)', cur, want });
  else plan.push({ slug, name: row.name, action: 'set .com URL', cur, want });
}
for (const slug of US_NEUTRALIZE) {
  const row = bySlug.get(slug);
  if (!row) { console.warn(`skip (not in DB): ${slug}`); continue; }
  const cur = currentUsAsin(row);
  const legacyCom = isCom(row.affiliate_url) || isCom(row.global_affiliate_url);
  if (!cur && !legacyCom) plan.push({ slug, name: row.name, action: 'ok (us neutralized)', cur: null, want: null });
  else plan.push({ slug, name: row.name, action: 'neutralize .com → .in fallback', cur, want: null });
}
if (unpublish) {
  for (const slug of ARCHIVE_NO_LISTING) {
    const row = bySlug.get(slug);
    if (!row) { console.warn(`skip (not in DB): ${slug}`); continue; }
    if (row.status === 'archived') plan.push({ slug, name: row.name, action: 'ok (archived)', cur: row.status, want: 'archived' });
    else plan.push({ slug, name: row.name, action: 'archive (no listing on either store)', cur: row.status, want: 'archived' });
  }
  for (const slug of DRAFT_COM_ONLY) {
    const row = bySlug.get(slug);
    if (!row) { console.warn(`skip (not in DB): ${slug}`); continue; }
    if (row.status === 'draft') plan.push({ slug, name: row.name, action: 'ok (draft)', cur: row.status, want: 'draft' });
    else plan.push({ slug, name: row.name, action: 'draft (.com only — no amazon.in)', cur: row.status, want: 'draft' });
  }
}

console.log(`DB: ${dbPath}   mode: ${apply ? 'APPLY' : 'DRY RUN (use --apply to write)'}${unpublish ? '   + unpublish no-.in products' : ''}\n`);
let changed = 0;
for (const p of plan) {
  const flag = p.action.startsWith('ok') ? '  ' : '→ ';
  const show = p.action.includes('.in') || p.action === 'ok (in set)'
    ? (asinOf(p.want) || (p.cur && asinOf(p.cur)) || '—')
    : String(p.cur || '—');
  const tail = p.action.startsWith('ok') ? ''
    : /^[A-Z0-9]{10}$/.test(String(p.want || '')) ? `→ ${p.want}`
    : (p.action.startsWith('archive') || p.action.startsWith('draft')) ? `→ ${p.want}`
    : '→ (cleared)';
  console.log(`${flag}${p.slug.padEnd(34)} ${p.action} ${tail}`);
  if (!p.action.startsWith('ok')) changed++;
}
console.log(`\n${plan.length} products checked, ${changed} to change.`);

console.log('\n⚠️  REVIEW — no genuine amazon.in listing (dead India CTA, editorial decision needed):');
for (const slug of REVIEW_NO_IN_LISTING) {
  const row = bySlug.get(slug);
  if (row) console.log(`   - ${slug} (${row.name})`);
}

if (!apply) {
  console.log('\nDry run only — nothing written. Re-run with --apply to execute.');
  process.exit(0);
}
if (changed === 0) { console.log('Nothing to do.'); process.exit(0); }

const backupsDir = path.resolve(process.cwd(), './data/backups');
fs.mkdirSync(backupsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
const backupFile = path.join(backupsDir, `alaya-amazonlinks-${stamp}.db`);
fs.copyFileSync(dbPath, backupFile);
console.log(`Backup written: ${backupFile}`);

const tx = db.transaction(() => {
  const setIn = db.prepare(`UPDATE products SET india_affiliate_url = ?, updated_at = datetime('now') WHERE slug = ?`);
  const setUs = db.prepare(`UPDATE products SET us_affiliate_url = ?, updated_at = datetime('now') WHERE slug = ?`);
  const neutralizeUs = db.prepare(`
    UPDATE products
    SET us_affiliate_url = '',
        affiliate_url = CASE WHEN affiliate_url LIKE '%amazon.com%' THEN india_affiliate_url ELSE affiliate_url END,
        global_affiliate_url = CASE WHEN global_affiliate_url LIKE '%amazon.com%' THEN india_affiliate_url ELSE global_affiliate_url END,
        updated_at = datetime('now')
    WHERE slug = ?`);
  const setStatus = db.prepare(`UPDATE products SET status = ?, archived_at = CASE WHEN ? = 'archived' THEN datetime('now') ELSE archived_at END, updated_at = datetime('now') WHERE slug = ?`);
  for (const p of plan) {
    if (p.action === 'set .in URL') setIn.run(p.want, p.slug);
    else if (p.action === 'set .com URL') setUs.run(p.want, p.slug);
    else if (p.action === 'neutralize .com → .in fallback') neutralizeUs.run(p.slug);
    else if (p.action === 'archive (no listing on either store)' || p.action === 'draft (.com only — no amazon.in)') setStatus.run(p.want, p.want, p.slug);
  }
});
tx();
console.log('\nApplied. Verify live with:');
console.log('  curl -s https://alayainsider.com/api/products | grep -oE "(amazon_in_url|amazon_us_url)[^,]*" | head -40');
db.close();

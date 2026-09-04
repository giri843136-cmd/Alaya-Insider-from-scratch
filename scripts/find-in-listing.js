#!/usr/bin/env node
/**
 * Alaya Insider — find a real amazon.in listing for a product.
 *
 * The seeded amazon.in ASINs were never verified (most 404 on amazon.in today).
 * This helper searches amazon.in for a product name, collects organic results,
 * fetches each candidate's product page title, and ranks candidates by how
 * well the page title matches the product you're looking for.
 *
 *   node scripts/find-in-listing.js "Muji Aroma Diffuser"
 *   node scripts/find-in-listing.js "Le Creuset Dutch Oven 5.5 Qt" --top=3
 *
 * Prints candidates as:  <asin> | similarity | amazon.in page title
 * Pick the ASIN whose title matches your product, then verify once on the page
 * (amazon.in/dp/<ASIN>) before using it.
 */

const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function titleFromHtml(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
    .replace(/^Buy /, '').replace(/ Online at Low Prices in India - Amazon\.in$/, '').replace(/ - Amazon\.in$/, '').trim();
}

function similarity(a, b) {
  const wa = new Set(norm(a).split(' ').filter(w => w.length > 2));
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit++;
  return hit / Math.sqrt(wa.size * wb.size); // cosine-ish overlap
}

async function fetchWithRetry(url, ua, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': ua,
          'accept-language': 'en-IN,en;q=0.9',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (res.status === 503 || res.status === 200) return { status: res.status, html: await res.text() };
    } catch (e) { /* retry */ }
    await sleep(2500 * i);
  }
  return { status: 0, html: '' };
}

(async () => {
  const query = process.argv[2];
  if (!query) {
    console.error('Usage: node scripts/find-in-listing.js "Product Name" [--top=N]');
    process.exit(1);
  }
  const topArg = process.argv.find(a => a.startsWith('--top='));
  const top = topArg ? parseInt(topArg.split('=')[1], 10) : 4;

  const searchUrl = `https://www.amazon.in/gp/aw/s?k=${encodeURIComponent(query)}`;
  const { html } = await fetchWithRetry(searchUrl, UA_MOBILE);
  if (!html) { console.error('Search failed (blocked or network). Try again in a moment.'); process.exit(1); }

  // Organic result links: /<slug>/dp/<ASIN>/ref=mp_s_a_1_N
  const seen = new Map(); // asin -> { slug, rank }
  const re = /href="\/([a-z0-9\-]{4,150})\/dp\/([A-Z0-9]{10})\/ref=mp_s_a_1_(\d+)/gi;
  let m;
  let rank = 0;
  while ((m = re.exec(html))) {
    rank++;
    const [, slug, asin] = m;
    if (!seen.has(asin)) seen.set(asin, { slug, first: rank });
  }
  const cands = [...seen.entries()].sort((a, b) => a[1].first - b[1].first).slice(0, top);
  if (!cands.length) { console.log('No organic results found on amazon.in for:', query); process.exit(0); }

  console.log(`Search: "${query}"  → ${cands.length} candidates to verify on amazon.in\n`);
  for (const [asin, { slug }] of cands) {
    await sleep(1200);
    const dp = await fetchWithRetry(`https://www.amazon.in/dp/${asin}`, UA_DESKTOP);
    const t = titleFromHtml(dp.html);
    const ok = dp.status === 200 && t && !/page not found/i.test(t);
    const score = ok ? similarity(t, query) : 0;
    const flag = score >= 0.55 ? '👍' : '  ';
    console.log(`${flag} ${asin} | sim ${score.toFixed(2)} | ${ok ? t.slice(0, 110) : `(HTTP ${dp.status})`} | /${slug.slice(0, 60)}`);
  }
})();

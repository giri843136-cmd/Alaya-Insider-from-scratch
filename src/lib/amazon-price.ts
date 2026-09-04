/**
 * Live Amazon pricing for Alaya Insider — dual-store (amazon.in + amazon.com).
 *
 * Live data comes from the official **Amazon Creators API** (the successor to
 * PA-API 5.0, which Amazon retired on 2026-05-15):
 *
 *   - India: marketplace www.amazon.in, tag -21, INR, token api.amazon.co.uk
 *   - US:    marketplace www.amazon.com, tag -20, USD, token api.amazon.com
 *   - Auth:  OAuth 2.0 client-credentials (see src/lib/creators-api.ts)
 *   - Caching: per (store, ASIN) SQLite cache, refreshed hourly (Amazon requires
 *     prices to refresh at least every hour OR be shown with an "as of" stamp —
 *     we do both: 1-hour TTL + an as-of label on product pages).
 *
 * Every lookup degrades gracefully: when credentials are missing, the API is
 * unreachable, or the ASIN is invalid, callers get a LivePrice with price:null
 * and the UI falls back to "Check price on Amazon". A US lookup that fails
 * falls back to the India price/link rather than surfacing an error. This
 * module never throws for a normal price lookup.
 */

import getDb from './db';
import { creatorsGetItems, isConfigured, getDiagnostics, getAllDiagnostics, STORES, storeConfig, type Store, DEFAULT_STORE } from './creators-api';
import { liveDisplayFields } from './price-format';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LivePrice {
  price: number | null;
  currency: string;
  /** true only when Amazon returned the item with a real offer price */
  available: boolean;
  /** epoch ms when the data was fetched from Amazon (or cache write time) */
  fetchedAt: number | null;
}

const emptyFor = (store: Store): LivePrice => ({ price: null, currency: STORES[store].currency, available: false, fetchedAt: null });

// ─── Cache policy ───────────────────────────────────────────────────────────
// Successful lookups: 1 hour (meets Amazon's hourly-refresh requirement).
// Failed lookups: 60s — enough to stop request storms but fast enough to pick
// up a corrected credential within a minute.
const CACHE_TTL_OK_MS = 60 * 60 * 1000;
const CACHE_TTL_FAIL_MS = 60 * 1000;

interface CacheRow {
  store: string;
  asin: string;
  ok: number;
  payload: string;
  error_code: string;
  error_message: string;
  fetched_at: string;
}

// ─── Cache table (lazy-create so this module works in tests too) ───────────

let tableReady = false;
function ensureCacheTable() {
  if (tableReady) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS amazon_price_cache (
      store TEXT NOT NULL DEFAULT 'in',
      asin TEXT NOT NULL,
      ok INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL DEFAULT '{}',
      error_code TEXT DEFAULT '',
      error_message TEXT DEFAULT '',
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (store, asin)
    );
  `);
  tableReady = true;
}

function readCache(store: Store, asin: string): { row: CacheRow; fresh: boolean } | null {
  try {
    ensureCacheTable();
    const row = getDb().prepare('SELECT store, asin, ok, payload, error_code, error_message, fetched_at FROM amazon_price_cache WHERE store = ? AND asin = ?')
      .get(store, asin) as CacheRow | undefined;
    if (!row) return null;
    const age = Date.now() - Date.parse(row.fetched_at);
    const ttl = row.ok === 1 ? CACHE_TTL_OK_MS : CACHE_TTL_FAIL_MS;
    return { row, fresh: age >= 0 && age < ttl };
  } catch {
    return null;
  }
}

function writeCache(store: Store, asin: string, ok: boolean, payload: object, error?: { code: string; message: string }) {
  try {
    ensureCacheTable();
    getDb().prepare(`
      INSERT INTO amazon_price_cache (store, asin, ok, payload, error_code, error_message, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(store, asin) DO UPDATE SET
        ok = excluded.ok, payload = excluded.payload,
        error_code = excluded.error_code, error_message = excluded.error_message,
        fetched_at = excluded.fetched_at
    `).run(store, asin, ok ? 1 : 0, JSON.stringify(payload), error?.code || '', error?.message || '', new Date().toISOString());
  } catch {
    // Cache is best-effort; the site must work without it.
  }
}

function rowToLive(row: CacheRow): LivePrice {
  let payload: any = {};
  try { payload = JSON.parse(row.payload); } catch { /* ignore */ }
  const store = (row.store as Store) || 'in';
  return {
    price: typeof payload.price === 'number' ? payload.price : null,
    currency: payload.currency || STORES[store].currency,
    available: !!payload.available,
    fetchedAt: Date.parse(row.fetched_at) || null,
  };
}

function normalizeAsin(asin: string): string | null {
  const a = (asin || '').trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(a) ? a : null;
}

// ─── ASIN helpers ───────────────────────────────────────────────────────────

/**
 * Extract an ASIN from an Amazon URL or return null.
 */
export function extractAsin(url: string): string | null {
  if (!url) return null;

  // Match /dp/ASIN, /gp/product/ASIN, /product/ASIN patterns
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/ASIN\/([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  // If it's already a bare ASIN (10 alphanumeric chars)
  if (/^[A-Z0-9]{10}$/i.test(url.trim())) {
    return url.trim().toUpperCase();
  }

  return null;
}

/**
 * Resolve the Amazon.in ASIN for a product (India-first).
 * We look at the India destination URL first, then a legacy single link if it
 * points at amazon.in. Amazon.com ASINs are intentionally NOT queried against
 * the amazon.in marketplace (they would always fail with ItemNotAccessible).
 */
export function productIndiaAsin(product: any): string | null {
  if (!product) return null;
  const indiaUrl = product.india_affiliate_url ||
    (typeof product.affiliate_url === 'string' && product.affiliate_url.includes('.amazon.in') ? product.affiliate_url : '');
  return indiaUrl ? extractAsin(indiaUrl) : null;
}

/**
 * Resolve the Amazon.com ASIN for a product. The US store uses the product's
 * dedicated US URL when present, else falls back to the legacy/global URL if
 * it points at amazon.com. Products without a US ASIN simply never serve US
 * prices (their links fall back to the .in store or OneLink).
 */
export function productUsAsin(product: any): string | null {
  if (!product) return null;
  const usUrl = product.us_affiliate_url ||
    (typeof product.affiliate_url === 'string' && product.affiliate_url.includes('.amazon.com') ? product.affiliate_url : '') ||
    (typeof product.global_affiliate_url === 'string' && product.global_affiliate_url.includes('.amazon.com') ? product.global_affiliate_url : '');
  return usUrl ? extractAsin(usUrl) : null;
}

/** ASIN for a specific store (null when the product has no listing there). */
export function productAsinForStore(product: any, store: Store): string | null {
  return store === 'us' ? productUsAsin(product) : productIndiaAsin(product);
}

/**
 * Direct Amazon URL for a store (no internal /go redirector — required so
 * OneLink's JavaScript can rewrite the anchor for the 9 secondary markets).
 * Always carries the store's partner tag and rel/target handled by callers.
 */
export function storeAffiliateUrl(product: any, store: Store): string {
  const cfg = storeConfig(store);
  if (!product) return '';
  const stored = store === 'us' ? product.us_affiliate_url : product.india_affiliate_url;
  const asin = productAsinForStore(product, store);
  const base = (stored && stored.startsWith('http')) ? stored : (asin ? `https://${cfg.marketplace}/dp/${asin}` : '');
  if (!base) return '';
  try {
    const u = new URL(base);
    // OneLink needs the anchor to point directly at the marketplace domain —
    // rewrite the host to the store's marketplace so .in/.com never mixes.
    u.hostname = cfg.marketplace;
    u.searchParams.set('tag', cfg.defaultTag);
    return u.toString();
  } catch {
    return base;
  }
}

/** Direct amazon.in URL for a product (OneLink-friendly). */
export function productIndiaUrl(product: any): string {
  return storeAffiliateUrl(product, 'in');
}

/** Direct amazon.com URL for a product (OneLink-friendly). */
export function productUsUrl(product: any): string {
  return storeAffiliateUrl(product, 'us');
}

// ─── Public lookups ─────────────────────────────────────────────────────────

/**
 * Live price for a single ASIN in one store.
 * Returns price:null (never throws) when data is unavailable — callers MUST
 * render "Check current price on Amazon" instead of a number.
 */
export async function getLivePrice(asin: string, store: Store = DEFAULT_STORE): Promise<LivePrice> {
  const normalized = normalizeAsin(asin);
  if (!normalized) return { ...emptyFor(store) };

  const cached = readCache(store, normalized);
  if (cached?.fresh) {
    if (cached.row.ok === 1) return rowToLive(cached.row);
    return { ...emptyFor(store) };
  }

  if (!isConfigured(store)) return { ...emptyFor(store) };

  const result = await creatorsGetItems([normalized], store);
  return applyResult(store, normalized, result);
}

/**
 * Live prices for many ASINs in one store, batched into Creators API GetItems
 * calls (up to 10 ASINs each). Cache hits skip the network entirely.
 */
export async function getLivePrices(
  asins: string[],
  storeOrOpts?: Store | { force?: boolean },
  opts?: { force?: boolean },
): Promise<Map<string, LivePrice>> {
  // Backward-compatible overload: getLivePrices(asins, { force }) was the old
  // signature; now the store is the primary second argument.
  const store: Store = typeof storeOrOpts === 'string' ? (storeOrOpts as Store) : DEFAULT_STORE;
  const options: { force?: boolean } | undefined = typeof storeOrOpts === 'object' ? (storeOrOpts as { force?: boolean }) : opts;

  const normalized = [...new Set(asins.map(normalizeAsin).filter(Boolean) as string[])];
  const out = new Map<string, LivePrice>();

  if (normalized.length === 0) return out;

  const misses: string[] = [];
  for (const asin of normalized) {
    const cached = readCache(store, asin);
    if (cached?.fresh && !options?.force) {
      out.set(asin, cached.row.ok === 1 ? rowToLive(cached.row) : { ...emptyFor(store) });
    } else {
      misses.push(asin);
    }
  }

  if (misses.length === 0) return out;

  if (!isConfigured(store)) {
    for (const asin of misses) out.set(asin, { ...emptyFor(store) });
    return out;
  }

  for (let i = 0; i < misses.length; i += 10) {
    const chunk = misses.slice(i, i + 10);
    const result = await creatorsGetItems(chunk, store);
    for (const asin of chunk) {
      out.set(asin, applyResult(store, asin, result));
    }
  }

  return out;
}

/**
 * Turn a Creators API result into a LivePrice for one requested ASIN and
 * persist the cache row. Called by getLivePrice / getLivePrices.
 */
function applyResult(store: Store, asin: string, result: { items: any[]; errors: any[] }): LivePrice {
  const item = result.items.find((it: any) => it.asin === asin);
  if (item) {
    const price = typeof item.priceAmount === 'number' && item.priceAmount > 0 ? item.priceAmount : null;
    const live: LivePrice = {
      price,
      currency: item.currency || STORES[store].currency,
      available: price !== null,
      fetchedAt: Date.now(),
    };
    // ok=1 even when the item is currently out of stock / has no offer, so we
    // don't re-hit Amazon every minute for an hour.
    writeCache(store, asin, true, { price, currency: live.currency, available: live.available }, undefined);
    return live;
  }

  const err = result.errors.find((e: any) => (e.code || '').toLowerCase().includes('notaccessible')) ||
    result.errors[0];
  if (err) {
    writeCache(store, asin, false, {}, { code: err.code || 'API_ERROR', message: err.message || '' });
  }
  return { ...emptyFor(store) };
}

// ─── Convenience for pages ──────────────────────────────────────────────────

/**
 * Attach live display fields to an array of product rows in one batched API
 * round-trip per store. For the US (international) store, products WITHOUT a
 * US ASIN fall back to their India price/link (they only exist on .in);
 * products WITH a US ASIN whose US price is unavailable (store unconfigured,
 * lookup failed, out of stock) get a fallback price box anchored at the .com
 * listing (-20) so OneLink can localize it — never a ₹/.in hybrid for a
 * non-India visitor, and never an error.
 *
 * Each product row gains:
 *   live_price / live_currency / live_fetched_at / live_available
 *   live_store        — which store the displayed price came from ('in'|'us')
 *   live_asin         — the ASIN the price came from
 *   amazon_url        — direct anchor for the display store (OneLink-friendly)
 *   amazon_in_url / amazon_us_url — direct anchors for both stores
 */
export async function enrichProductsWithLivePrice(products: any[], store: Store = DEFAULT_STORE): Promise<any[]> {
  if (!products || products.length === 0) return products || [];

  const usAsins = [...new Set(products.map(productUsAsin).filter(Boolean) as string[])];
  const inAsins = [...new Set(products.map(productIndiaAsin).filter(Boolean) as string[])];

  // Fetch the primary store first; for US visitors also fetch India prices so
  // products without a US listing still show a ₹ fallback instead of nothing.
  const [primary, india] = store === 'us'
    ? [getLivePrices(usAsins, 'us'), getLivePrices(inAsins, 'in')]
    : [getLivePrices(inAsins, 'in'), Promise.resolve(new Map<string, LivePrice>())];

  const [liveMap, indiaMap] = await Promise.all([primary, india]);

  return products.map((p: any) => {
    const usAsin = productUsAsin(p);
    const inAsin = productIndiaAsin(p);

    if (store === 'us' && usAsin) {
      const usLive = liveMap.get(usAsin);
      const hasUsPrice = usLive?.price != null && usLive.price > 0;
      // Real US price → USD + .com anchor. Otherwise the product HAS a US
      // listing but its price is unavailable (store unconfigured / lookup
      // failed / out of stock): serve a fallback price box whose anchor stays
      // on the .com listing with -20 so OneLink can localize it for
      // non-India visitors — the .in price is NOT shown against a .com link.
      if (hasUsPrice) {
        return { ...p, ...liveDisplayFields(usLive, 'us'), live_store: 'us', live_asin: usAsin,
          amazon_url: productUsUrl(p), amazon_in_url: productIndiaUrl(p), amazon_us_url: productUsUrl(p) };
      }
      return { ...p, ...liveDisplayFields(null), live_store: 'us', live_asin: usAsin,
        amazon_url: productUsUrl(p), amazon_in_url: productIndiaUrl(p), amazon_us_url: productUsUrl(p) };
    }

    // store === 'us' but the product has no US ASIN — serve the India price
    // (fetched in the same batch) so international visitors still see a live
    // box on the only marketplace where the product exists.
    const inLive = inAsin ? indiaMap.get(inAsin) ?? liveMap.get(inAsin) : null;
    return { ...p, ...liveDisplayFields(inLive, 'in'), live_store: 'in', live_asin: inAsin,
      amazon_url: productIndiaUrl(p), amazon_in_url: productIndiaUrl(p), amazon_us_url: productUsUrl(p) };
  });
}

/** Diagnostics surface used by /admin/amazon and /api/creators/* */
export { getDiagnostics, getAllDiagnostics } from './creators-api';
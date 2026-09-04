/**
 * Live Amazon.in pricing for Alaya Insider.
 *
 * IMPORTANT — this module no longer scrapes Amazon product pages (that was a
 * policy/ToS problem and relied on PA-API 5.0 env vars that were never used).
 * Live data now comes from the official **Amazon Creators API** (the successor
 * to PA-API 5.0, which Amazon retired on 2026-05-15):
 *
 *   - Marketplace: Amazon.in (www.amazon.in) with the site's "-21" Partner Tag
 *   - Auth: OAuth 2.0 client-credentials (see src/lib/creators-api.ts)
 *   - Caching: per-ASIN SQLite cache, refreshed hourly (Amazon requires prices
 *     to refresh at least every hour OR be shown with an "as of" stamp — we do
 *     both: 1-hour TTL + an as-of label on product pages).
 *
 * Every lookup degrades gracefully: when credentials are missing, the API is
 * unreachable, or the ASIN is invalid, callers get a LivePrice with
 * price: null and the UI falls back to "Check price on Amazon". This module
 * never throws for a normal price lookup.
 */

import getDb from './db';
import { creatorsGetItems, isConfigured, getDiagnostics } from './creators-api';
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

const EMPTY: LivePrice = { price: null, currency: 'INR', available: false, fetchedAt: null };

// ─── Cache policy ───────────────────────────────────────────────────────────
// Successful lookups: 1 hour (meets Amazon's hourly-refresh requirement).
// Failed lookups: 60s — enough to stop request storms but fast enough to pick
// up a corrected credential within a minute.
const CACHE_TTL_OK_MS = 60 * 60 * 1000;
const CACHE_TTL_FAIL_MS = 60 * 1000;

interface CacheRow {
  asin: string;
  ok: number;
  payload: string;
  fetched_at: string;
}

// ─── Cache table (lazy-create so this module works in tests too) ───────────

let tableReady = false;
function ensureCacheTable() {
  if (tableReady) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS amazon_price_cache (
      asin TEXT PRIMARY KEY,
      ok INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL DEFAULT '{}',
      error_code TEXT DEFAULT '',
      error_message TEXT DEFAULT '',
      fetched_at TEXT NOT NULL
    );
  `);
  tableReady = true;
}

function readCache(asin: string): { row: CacheRow; fresh: boolean } | null {
  try {
    ensureCacheTable();
    const row = getDb().prepare('SELECT asin, ok, payload, fetched_at FROM amazon_price_cache WHERE asin = ?').get(asin) as CacheRow | undefined;
    if (!row) return null;
    const age = Date.now() - Date.parse(row.fetched_at);
    const ttl = row.ok === 1 ? CACHE_TTL_OK_MS : CACHE_TTL_FAIL_MS;
    return { row, fresh: age >= 0 && age < ttl };
  } catch {
    return null;
  }
}

function writeCache(asin: string, ok: boolean, payload: object, error?: { code: string; message: string }) {
  try {
    ensureCacheTable();
    getDb().prepare(`
      INSERT INTO amazon_price_cache (asin, ok, payload, error_code, error_message, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(asin) DO UPDATE SET
        ok = excluded.ok, payload = excluded.payload,
        error_code = excluded.error_code, error_message = excluded.error_message,
        fetched_at = excluded.fetched_at
    `).run(asin, ok ? 1 : 0, JSON.stringify(payload), error?.code || '', error?.message || '', new Date().toISOString());
  } catch {
    // Cache is best-effort; the site must work without it.
  }
}

function rowToLive(row: CacheRow): LivePrice {
  let payload: any = {};
  try { payload = JSON.parse(row.payload); } catch { /* ignore */ }
  return {
    price: typeof payload.price === 'number' ? payload.price : null,
    currency: payload.currency || 'INR',
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
 * The single live-price slot on this site shows Amazon.in data, so we look at
 * the India destination URL first, then a legacy single link if it points at
 * amazon.in. Amazon.com ASINs are intentionally NOT queried against the
 * amazon.in marketplace (they would always fail with ItemNotAccessible).
 */
export function productIndiaAsin(product: any): string | null {
  if (!product) return null;
  const indiaUrl = product.india_affiliate_url ||
    (typeof product.affiliate_url === 'string' && product.affiliate_url.includes('.amazon.in') ? product.affiliate_url : '');
  return indiaUrl ? extractAsin(indiaUrl) : null;
}

// ─── Public lookups ─────────────────────────────────────────────────────────

/**
 * Live price for a single amazon.in ASIN.
 * Returns price:null (never throws) when data is unavailable — callers MUST
 * render "Check current price on Amazon" instead of a number.
 */
export async function getLivePrice(asin: string): Promise<LivePrice> {
  const normalized = normalizeAsin(asin);
  if (!normalized) return { ...EMPTY };

  const cached = readCache(normalized);
  if (cached?.fresh) {
    if (cached.row.ok === 1) return rowToLive(cached.row);
    return { ...EMPTY };
  }

  if (!isConfigured()) return { ...EMPTY };

  const result = await creatorsGetItems([normalized]);
  return applyResult(normalized, result);
}

/**
 * Live prices for many ASINs, batched into Creators API GetItems calls
 * (up to 10 ASINs each). Cache hits skip the network entirely.
 */
export async function getLivePrices(asins: string[], opts?: { force?: boolean }): Promise<Map<string, LivePrice>> {
  const normalized = [...new Set(asins.map(normalizeAsin).filter(Boolean) as string[])];
  const out = new Map<string, LivePrice>();

  if (normalized.length === 0) return out;

  const misses: string[] = [];
  for (const asin of normalized) {
    const cached = readCache(asin);
    if (cached?.fresh && !opts?.force) {
      out.set(asin, cached.row.ok === 1 ? rowToLive(cached.row) : { ...EMPTY });
    } else {
      misses.push(asin);
    }
  }

  if (misses.length === 0) return out;

  if (!isConfigured()) {
    for (const asin of misses) out.set(asin, { ...EMPTY });
    return out;
  }

  for (let i = 0; i < misses.length; i += 10) {
    const chunk = misses.slice(i, i + 10);
    const result = await creatorsGetItems(chunk);
    for (const asin of chunk) {
      out.set(asin, applyResult(asin, result));
    }
  }

  return out;
}

/**
 * Turn a Creators API result into a LivePrice for one requested ASIN and
 * persist the cache row. Called by getLivePrice / getLivePrices.
 */
function applyResult(asin: string, result: { items: any[]; errors: any[] }): LivePrice {
  const item = result.items.find((it: any) => it.asin === asin);
  if (item) {
    const price = typeof item.priceAmount === 'number' && item.priceAmount > 0 ? item.priceAmount : null;
    const live: LivePrice = {
      price,
      currency: item.currency || 'INR',
      available: price !== null,
      fetchedAt: Date.now(),
    };
    // ok=1 even when the item is currently out of stock / has no offer, so we
    // don't re-hit Amazon every minute for an hour.
    writeCache(asin, true, { price, currency: live.currency, available: live.available }, undefined);
    return live;
  }

  const err = result.errors.find((e: any) => (e.code || '').toLowerCase().includes('notaccessible')) ||
    result.errors[0];
  if (err) {
    writeCache(asin, false, {}, { code: err.code || 'API_ERROR', message: err.message || '' });
  }
  return { ...EMPTY };
}

// ─── Convenience for pages ──────────────────────────────────────────────────

/**
 * Attach live display fields (live_price / live_currency / live_fetched_at /
 * live_available) to an array of product rows in one batched API round-trip.
 */
export async function enrichProductsWithLivePrice(products: any[]): Promise<any[]> {
  if (!products || products.length === 0) return products || [];

  const asins = [...new Set(products.map(productIndiaAsin).filter(Boolean) as string[])];
  const liveMap = await getLivePrices(asins);

  return products.map((p: any) => {
    const asin = productIndiaAsin(p);
    return { ...p, ...liveDisplayFields(asin ? liveMap.get(asin) : null) };
  });
}

/** Diagnostics surface used by /admin/amazon and /api/creators/* */
export { getDiagnostics };

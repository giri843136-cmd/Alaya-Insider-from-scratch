/**
 * Server-side visitor geo-detection for the dual-store routing:
 *
 *   IN → store 'in' (amazon.in, ₹, tag -21)
 *   every other DETECTED country (US, DE, GB, AE, …) → store 'us'
 *     (amazon.com, $, tag -20) — the international default. OneLink's script
 *     then rewrites those .com anchors to the visitor's local store, so a
 *     German visitor ends up on amazon.de with -20. Products without a US
 *     ASIN keep the .in rendering (they only exist on amazon.in).
 *   unknown / not detected → store 'in' (safe default — see below)
 *
 * Detection chain (first hit wins):
 *   1. `CF-IPCountry` request header — behind Cloudflare this gives a
 *      reliable, free, per-request country code with zero network calls.
 *      (Verified 2026-09-04: alayainsider.com is served by Hostinger's hcdn,
 *      NOT Cloudflare — so this header is currently absent and detection falls
 *      through to MaxMind / the India default. Re-check after any CDN move.)
 *   2. MaxMind GeoLite2 local DB (data/GeoLite2-Country.mmdb) — no third-party
 *      API, no client-side lookup; used only when the header is absent.
 *      Install it (see RUNBOOK "Install GeoLite2") to activate IP routing.
 *   3. Default: India.
 *
 * `x-test-geo` header overrides everything but is honored ONLY when
 * NODE_ENV !== 'production' so tests/dev can simulate a country.
 */

import fs from 'fs';
import path from 'path';

export type VisitorStore = 'in' | 'us';

export const GEO_DB_DEFAULT = './data/GeoLite2-Country.mmdb';

let geoReader: any = null;
let geoReaderTried = false;

function geoDbPath(): string {
  return path.resolve(process.cwd(), process.env.GEOIP_DB_PATH || GEO_DB_DEFAULT);
}

/** Lazy MaxMind reader — returns null when the .mmdb file is missing. */
export function getGeoReader(): any {
  if (geoReaderTried) return geoReader;
  geoReaderTried = true;
  try {
    if (!fs.existsSync(geoDbPath())) return null;
    const maxmind = require('maxmind') as { openSync: (f: string) => any };
    geoReader = maxmind.openSync(geoDbPath());
  } catch (e: any) {
    console.warn(`GeoLite2 reader unavailable (${e?.message}) — geo falls back to India.`);
    geoReader = null;
  }
  return geoReader;
}

/** Country code (ISO-3166-1 alpha-2, uppercased) → visitor store. */
export function countryToStore(country: string | null | undefined): VisitorStore {
  const c = (country || '').trim().toUpperCase();
  if (!c || c === 'ZZ') return 'in'; // empty / MaxMind's "unknown" designation → India default
  if (c === 'IN') return 'in';
  return 'us'; // every other country → amazon.com international default (-20); OneLink localizes
}

export function countryName(country: string | null | undefined): string {
  const c = (country || '').trim().toUpperCase();
  return c || 'Unknown';
}

function firstHeader(headers: Headers | Record<string, string>, name: string): string {
  const lower = name.toLowerCase();
  if (typeof (headers as any).get === 'function') {
    return (headers as Headers).get(lower) || (headers as Headers).get(name) || '';
  }
  const h = headers as Record<string, string>;
  return h[lower] || h[name] || '';
}

function clientIp(headers: Headers | Record<string, string>): string {
  const fwd = firstHeader(headers, 'x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = firstHeader(headers, 'x-real-ip');
  if (real) return real.trim();
  return '';
}

export interface GeoResult {
  store: VisitorStore;
  country: string;
  method: 'test-header' | 'cf-ipcountry' | 'maxmind' | 'default';
}

/**
 * Resolve the visitor store from request headers. Pure-ish (reads the local
 * MaxMind file once) — safe to call from server components, route handlers
 * and middleware. NEVER performs a client-side or third-party lookup.
 */
export function resolveVisitorStore(headers: Headers | Record<string, string>): GeoResult {
  // Test/dev override — strictly non-production.
  if (process.env.NODE_ENV !== 'production') {
    const test = firstHeader(headers, 'x-test-geo');
    if (test) {
      return { store: countryToStore(test), country: countryName(test), method: 'test-header' };
    }
  }

  // 1. CF-IPCountry (Cloudflare) — preferred.
  const cf = firstHeader(headers, 'cf-ipcountry');
  if (cf) {
    return { store: countryToStore(cf), country: countryName(cf), method: 'cf-ipcountry' };
  }

  // 2. MaxMind GeoLite2 local DB.
  const ip = clientIp(headers);
  if (ip) {
    try {
      const reader = getGeoReader();
      if (reader) {
        const rec = reader.get(ip);
        const iso: string | undefined = rec?.country?.iso_code || rec?.registered_country?.iso_code;
        if (iso) {
          return { store: countryToStore(iso), country: countryName(iso), method: 'maxmind' };
        }
      }
    } catch {
      // malformed IP or reader error — fall through to default
    }
  }

  // 3. Default: India.
  return { store: 'in', country: 'IN', method: 'default' };
}
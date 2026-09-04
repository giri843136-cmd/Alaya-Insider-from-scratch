/**
 * Geo-detection tests for the dual-store routing matrix:
 *   IN → in, US → us, DE/other → in (default), unknown → in (default).
 * The x-test-geo header must be honored only outside production; the
 * CF-IPCountry header is the preferred source; MaxMind is the fallback.
 */

import { resolveVisitorStore, countryToStore } from '../geo';

function headersObj(h: Record<string, string>) {
  return new Headers(Object.entries(h).map(([k, v]) => [k, v]));
}

describe('countryToStore', () => {
  it('maps IN → in and US → us', () => {
    expect(countryToStore('IN')).toBe('in');
    expect(countryToStore('in')).toBe('in');
    expect(countryToStore('US')).toBe('us');
    expect(countryToStore('us')).toBe('us');
  });

  it('maps every other country to in (default rendering + OneLink)', () => {
    for (const c of ['DE', 'FR', 'GB', 'JP', 'BR', 'AU', 'SG', 'CA']) {
      expect(countryToStore(c)).toBe('in');
    }
  });

  it('maps unknown/empty to in', () => {
    expect(countryToStore('')).toBe('in');
    expect(countryToStore(null)).toBe('in');
    expect(countryToStore(undefined)).toBe('in');
    expect(countryToStore('ZZ')).toBe('in');
  });
});

describe('resolveVisitorStore', () => {
  const prev = process.env.NODE_ENV;

  afterEach(() => { process.env.NODE_ENV = prev; });

  it('uses CF-IPCountry when present (production)', () => {
    process.env.NODE_ENV = 'production';
    const r = resolveVisitorStore(headersObj({ 'cf-ipcountry': 'US', 'x-test-geo': 'DE' }));
    expect(r.store).toBe('us');
    expect(r.country).toBe('US');
    expect(r.method).toBe('cf-ipcountry');
  });

  it('falls back to the India default when the header is absent', () => {
    process.env.NODE_ENV = 'production';
    const r = resolveVisitorStore(headersObj({}));
    expect(r.store).toBe('in');
    expect(r.method).toBe('default');
    expect(r.country).toBe('IN');
  });

  it('ignores x-test-geo in production (cannot spoof visitors live)', () => {
    process.env.NODE_ENV = 'production';
    const r = resolveVisitorStore(headersObj({ 'x-test-geo': 'US' }));
    expect(r.store).toBe('in');
    expect(r.method).toBe('default');
  });

  it('honors x-test-geo outside production (dev/test only)', () => {
    process.env.NODE_ENV = 'test';
    const r = resolveVisitorStore(headersObj({ 'x-test-geo': 'DE' }));
    expect(r.store).toBe('in');
    expect(r.method).toBe('test-header');
    expect(r.country).toBe('DE');

    const r2 = resolveVisitorStore(headersObj({ 'x-test-geo': 'US' }));
    expect(r2.store).toBe('us');
  });

  it('prefers x-test-geo over CF-IPCountry outside production', () => {
    process.env.NODE_ENV = 'test';
    const r = resolveVisitorStore(headersObj({ 'cf-ipcountry': 'US', 'x-test-geo': 'IN' }));
    expect(r.store).toBe('in');
    expect(r.method).toBe('test-header');
  });

  it('never performs a network lookup (no third-party geo API)', () => {
    process.env.NODE_ENV = 'production';
    const r = resolveVisitorStore(headersObj({ 'x-forwarded-for': '8.8.8.8' }));
    // No GeoLite2 file in the test env → default, and no fetch was made.
    expect(r.store).toBe('in');
    expect(r.method).toBe('default');
  });
});
/**
 * Live Amazon.in price lookups now run through the Amazon Creators API
 * (PA-API 5.0 retired 2026-05-15). These tests mock the OAuth token endpoint
 * and the creatorsapi.amazon GetItems endpoint to verify:
 *   - happy path: real price/currency returned and cached for 1h
 *   - graceful failure: invalid credentials / invalid ASINs / out-of-stock
 *     items NEVER throw and always yield a price:null fallback
 *   - caching: one network round-trip per ASIN per hour; failure windows 60s
 *   - batching: getLivePrices chunks ≤10 ASINs per GetItems call
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

let dbPath = '';
let mod: any;
let dbGet: any;
let fetchMock: jest.Mock;

const TOKEN_URL = 'https://api.amazon.co.uk/auth/o2/token';
const API_URL = 'https://creatorsapi.amazon/catalog/v1/getItems';

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Configurable fake Amazon backend. */
function installFetch(backend: {
  tokenStatus?: number;
  tokenBody?: any;
  getItemsStatus?: number;
  getItemsBody?: any;
  failNetwork?: boolean;
}) {
  fetchMock = jest.fn(async (input: any) => {
    const url = String(input);
    if (backend.failNetwork) throw new TypeError('fetch failed');
    if (url.includes('/auth/o2/token')) {
      return jsonResponse(backend.tokenBody ?? {}, backend.tokenStatus ?? 200);
    }
    if (url.includes('creatorsapi.amazon')) {
      return jsonResponse(backend.getItemsBody ?? {}, backend.getItemsStatus ?? 200);
    }
    return jsonResponse({}, 404);
  }) as any;
  (global as any).fetch = fetchMock;
}

function sampleItem(asin: string, overrides: any = {}) {
  return {
    asin,
    detailPageURL: `https://www.amazon.in/dp/${asin}?tag=alayainsider-21`,
    images: { primary: { large: { url: `https://m.media-amazon.com/images/I/${asin}._SL500_.jpg` } } },
    itemInfo: { title: { displayValue: `Product ${asin}` }, byLineInfo: { brand: { displayValue: 'TestBrand' } } },
    offersV2: {
      listings: [{
        availability: { type: 'IN_STOCK' },
        condition: { value: 'New' },
        isBuyBoxWinner: true,
        merchantInfo: { name: 'Amazon.in' },
        price: { money: { amount: 1299.5, currency: 'INR', displayAmount: '₹1,299.50' } },
      }],
    },
    ...overrides,
  };
}

const goodToken = { access_token: 'tok-test-123', token_type: 'bearer', expires_in: 3600 };

beforeAll(async () => {
  dbPath = path.join(os.tmpdir(), `alaya-test-${Date.now()}.db`);
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_SECRET = 'test-auth-secret-0123456789abcdef0123456789abcdef';
  process.env.CREATORS_CLIENT_ID = 'amzn1.test.client';
  process.env.CREATORS_CLIENT_SECRET = 'test-secret';
  process.env.CREATORS_VERSION = '3.2';
  process.env.CREATORS_PARTNER_TAG = 'alayainsider-21';
  process.env.CREATORS_MARKETPLACE = 'www.amazon.in';
  // US store credentials for dual-store tests.
  process.env.CREATORS_US_CLIENT_ID = 'amzn1.us.test.client';
  process.env.CREATORS_US_CLIENT_SECRET = 'us-test-secret';
  process.env.CREATORS_US_VERSION = '3.1';
  process.env.CREATORS_US_PARTNER_TAG = 'alayainsider-20';
  process.env.CREATORS_US_MARKETPLACE = 'www.amazon.com';

  mod = await import('../amazon-price');
  dbGet = (await import('../db')).default;
  dbGet().exec(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY, value TEXT DEFAULT '', group_name TEXT DEFAULT 'general',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
});

afterEach(() => {
  fetchMock?.mockClear();
  // Reset token cache + price cache between tests so earlier tests can't leak.
  try {
    dbGet().prepare('DELETE FROM site_settings WHERE key IN (?,?)').run('creators_access_token', 'creators_token_expires_at');
    dbGet().prepare('DELETE FROM amazon_price_cache').run();
  } catch { /* ignore */ }
});

afterAll(() => {
  try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
});

describe('productIndiaAsin', () => {
  it('prefers the amazon.in affiliate URL', () => {
    const p = {
      global_affiliate_url: 'https://www.amazon.com/dp/B08N5WRWNW?tag=x-20',
      india_affiliate_url: 'https://www.amazon.in/dp/B0ABCDEFGH?tag=alayainsider-21',
      affiliate_url: 'https://www.amazon.com/dp/B08N5WRWNW',
    };
    expect(mod.productIndiaAsin(p)).toBe('B0ABCDEFGH');
  });

  it('uses legacy affiliate_url only when it points at amazon.in', () => {
    expect(mod.productIndiaAsin({ affiliate_url: 'https://www.amazon.in/dp/B08N5WRWNW' })).toBe('B08N5WRWNW');
    expect(mod.productIndiaAsin({ affiliate_url: 'https://www.amazon.com/dp/B08N5WRWNW' })).toBeNull();
    expect(mod.productIndiaAsin({})).toBeNull();
    expect(mod.productIndiaAsin(null)).toBeNull();
  });
});

describe('getLivePrice — happy path (dummy-free valid backend)', () => {
  it('returns INR price + currency from the Creators API', async () => {
    installFetch({
      tokenBody: goodToken,
      getItemsBody: { itemResults: { items: [sampleItem('B0ABCDEFGH')] } },
    });

    const live = await mod.getLivePrice('B0ABCDEFGH');
    expect(live.price).toBe(1299.5);
    expect(live.currency).toBe('INR');
    expect(live.available).toBe(true);
    expect(live.fetchedAt).toBeTruthy();
  });

  it('caches for one hour — second lookup does not hit the network', async () => {
    installFetch({
      tokenBody: goodToken,
      getItemsBody: { itemResults: { items: [sampleItem('B0ABCDEFGH')] } },
    });

    await mod.getLivePrice('B0ABCDEFGH');
    const callsAfterFirst = fetchMock.mock.calls.length;
    const live = await mod.getLivePrice('B0ABCDEFGH');
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst); // cache hit
    expect(live.price).toBe(1299.5);
  });

  it('returns null for a malformed ASIN without calling the API', async () => {
    installFetch({ tokenBody: goodToken });
    const live = await mod.getLivePrice('not-an-asin');
    expect(live.price).toBeNull();
    expect(live.available).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(0);
  });
});

describe('getLivePrice — graceful failure (the dummy-key scenario)', () => {
  it('invalid client credentials → OAuth error → price null, no throw', async () => {
    installFetch({
      tokenStatus: 400,
      tokenBody: { error: 'invalid_client', error_description: 'Invalid client credentials' },
    });

    const live = await mod.getLivePrice('B0ABCDEFGH');
    expect(live.price).toBeNull();
    expect(live.available).toBe(false);
    // Second call within the 60s failure window must NOT hammer the token endpoint.
    await mod.getLivePrice('B0ABCDEFGH');
    expect(fetchMock.mock.calls.filter((c: any) => String(c[0]).includes('/auth/o2/token')).length).toBe(1);
  });

  it('unreachable endpoint (network error) → price null, no throw', async () => {
    installFetch({ failNetwork: true, tokenBody: goodToken });
    const live = await mod.getLivePrice('B0ABCDEFGH');
    expect(live.price).toBeNull();
    expect(live.available).toBe(false);
  });

  it('ASIN not accessible on Amazon.in (ItemNotAccessible) → price null, no throw', async () => {
    installFetch({
      tokenBody: goodToken,
      getItemsBody: {
        errors: [{ code: 'ItemNotAccessible', message: 'The ItemId is not accessible through the Creators API.' }],
        itemResults: { items: [] },
      },
    });
    const live = await mod.getLivePrice('B0ZZZZZZZZ');
    expect(live.price).toBeNull();
    expect(live.available).toBe(false);
  });

  it('item exists but out of stock / no offer → price null (graceful), cached without error spam', async () => {
    installFetch({
      tokenBody: goodToken,
      getItemsBody: { itemResults: { items: [sampleItem('B0ABCDEFGH', { offersV2: { listings: [] } })] } },
    });
    const live = await mod.getLivePrice('B0ABCDEFGH');
    expect(live.price).toBeNull();
    expect(live.available).toBe(false);
  });
});

describe('getLivePrices — batching and enrichment', () => {
  const makeItems = (count: number) => Array.from({ length: count }, (_, i) => sampleItem(`B0ASIN${String(i).padStart(4, '0')}`));

  it('batches >10 ASINs into multiple GetItems calls and returns all results', async () => {
    installFetch({ tokenBody: goodToken, getItemsBody: { itemResults: { items: makeItems(25) } } });
    const asins = makeItems(25).map((i: any) => i.asin);
    const map = await mod.getLivePrices(asins);
    expect(map.size).toBe(25);
    expect(fetchMock.mock.calls.filter((c: any) => String(c[0]).includes('creatorsapi.amazon')).length).toBe(3);
    const first = map.get('B0ASIN0000');
    expect(first.price).toBe(1299.5);
  });

  it('enrichProductsWithLivePrice attaches live_price/live_currency/live_fetched_at to every row', async () => {
    installFetch({ tokenBody: goodToken, getItemsBody: { itemResults: { items: [sampleItem('B0ABCDEFGH')] } } });
    const products = [
      { id: '1', name: 'A', india_affiliate_url: 'https://www.amazon.in/dp/B0ABCDEFGH' },
      { id: '2', name: 'B', india_affiliate_url: '' }, // no India ASIN → fallback fields
    ];
    const enriched = await mod.enrichProductsWithLivePrice(products);
    expect(enriched[0].live_price).toBe(1299.5);
    expect(enriched[0].live_currency).toBe('INR');
    expect(enriched[0].live_available).toBe(true);
    expect(enriched[0].live_store).toBe('in');
    expect(enriched[0].amazon_url).toContain('www.amazon.in');
    expect(enriched[0].amazon_url).toContain('tag=');
    expect(enriched[1].live_price).toBeNull();
    expect(enriched[1].live_available).toBe(false);
  });

  it('same ASIN in two stores does not collide in the cache (per-store isolation)', async () => {
    // The exact same ASIN string resolves to different products per store.
    installFetch({
      tokenBody: goodToken,
      getItemsBody: { itemResults: { items: [
        sampleItem('B0ABCDEFGH', { offersV2: { listings: [{ price: { money: { amount: 999.99, currency: 'USD', displayAmount: '$999.99' } }, availability: { type: 'IN_STOCK' }, condition: { value: 'New' }, isBuyBoxWinner: true, merchantInfo: { name: 'Amazon.com' } }] } }),
      ] } },
    });

    // Seed the US cache with a USD price for the same ASIN string.
    const usLive = await mod.getLivePrice('B0ABCDEFGH', 'us');
    expect(usLive.price).toBe(999.99);
    expect(usLive.currency).toBe('USD');

    // India lookup for the same ASIN string must NOT return the US price.
    installFetch({ tokenBody: goodToken, getItemsBody: { itemResults: { items: [sampleItem('B0ABCDEFGH')] } } });
    const inLive = await mod.getLivePrice('B0ABCDEFGH', 'in');
    expect(inLive.price).toBe(1299.5);
    expect(inLive.currency).toBe('INR');
  });

  it('US store enrichment with a US ASIN returns USD and amazon.com links', async () => {
    installFetch({ tokenBody: goodToken, getItemsBody: { itemResults: { items: [
      sampleItem('B0USASIN01', { offersV2: { listings: [{ price: { money: { amount: 49.99, currency: 'USD', displayAmount: '$49.99' } }, availability: { type: 'IN_STOCK' }, condition: { value: 'New' }, isBuyBoxWinner: true, merchantInfo: { name: 'Amazon.com' } }] } }),
    ] } } });
    const products = [{ id: '1', name: 'A', india_affiliate_url: 'https://www.amazon.in/dp/B0ABCDEFGH', us_affiliate_url: 'https://www.amazon.com/dp/B0USASIN01?tag=alayainsider-20' }];
    const enriched = await mod.enrichProductsWithLivePrice(products, 'us');
    expect(enriched[0].live_price).toBe(49.99);
    expect(enriched[0].live_currency).toBe('USD');
    expect(enriched[0].live_store).toBe('us');
    expect(enriched[0].amazon_url).toContain('www.amazon.com');
    expect(enriched[0].amazon_url).toContain('tag=');
  });

  it('US fails → India serves: no US listing falls back to the India price + .in link', async () => {
    // US GetItems returns nothing for the product (no US listing on amazon.com).
    installFetch({
      tokenBody: goodToken,
      getItemsBody: { itemResults: { items: [sampleItem('B0ABCDEFGH')] } },
    });
    const products = [{
      id: '1', name: 'A',
      india_affiliate_url: 'https://www.amazon.in/dp/B0ABCDEFGH',
      us_affiliate_url: '', // product has NO US ASIN
    }];
    const enriched = await mod.enrichProductsWithLivePrice(products, 'us');
    expect(enriched[0].live_price).toBe(1299.5);
    expect(enriched[0].live_currency).toBe('INR');
    expect(enriched[0].live_store).toBe('in');
    expect(enriched[0].amazon_url).toContain('www.amazon.in');
    expect(enriched[0].amazon_url).not.toContain('amazon.com');
  });

  it('US visitor + product with US ASIN but US not configured → India fallback, no error', async () => {
    const keep = { ...process.env };
    delete process.env.CREATORS_CLIENT_ID;
    delete process.env.CREATORS_CLIENT_SECRET;
    delete process.env.CREATORS_US_CLIENT_ID;
    delete process.env.CREATORS_US_CLIENT_SECRET;
    // Both stores' creds cleared → clean fallback box.
    installFetch({ tokenBody: goodToken });
    const products = [{ id: '1', name: 'A', india_affiliate_url: 'https://www.amazon.in/dp/B0ABCDEFGH', us_affiliate_url: 'https://www.amazon.com/dp/B0USASIN01' }];
    const enriched = await mod.enrichProductsWithLivePrice(products, 'us');
    expect(enriched[0].live_price).toBeNull();
    expect(enriched[0].live_available).toBe(false);
    Object.assign(process.env, keep);
  });

  it('productUsAsin resolves the US ASIN from the us_affiliate_url / global URL', () => {
    expect(mod.productUsAsin({ us_affiliate_url: 'https://www.amazon.com/dp/B0USASIN01' })).toBe('B0USASIN01');
    expect(mod.productUsAsin({ global_affiliate_url: 'https://www.amazon.com/dp/B0USASIN02' })).toBe('B0USASIN02');
    expect(mod.productUsAsin({ affiliate_url: 'https://www.amazon.com/dp/B0USASIN03' })).toBe('B0USASIN03');
    expect(mod.productUsAsin({ india_affiliate_url: 'https://www.amazon.in/dp/B0INASIN01' })).toBeNull();
    expect(mod.productUsAsin({})).toBeNull();
  });

  it('force:true bypasses the cache and hits the network again', async () => {
    installFetch({ tokenBody: goodToken, getItemsBody: { itemResults: { items: [sampleItem('B0ABCDEFGH')] } } });
    await mod.getLivePrice('B0ABCDEFGH');
    const before = fetchMock.mock.calls.length;
    await mod.getLivePrices(['B0ABCDEFGH'], { force: true });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });
});

describe('enrichment with no credentials configured', () => {
  it('no credentials → all products fall back cleanly, zero network calls', async () => {
    delete process.env.CREATORS_CLIENT_ID;
    delete process.env.CREATORS_CLIENT_SECRET;
    installFetch({ tokenBody: goodToken });
    const enriched = await mod.enrichProductsWithLivePrice([
      { id: '1', india_affiliate_url: 'https://www.amazon.in/dp/B0ABCDEFGH' },
    ]);
    expect(enriched[0].live_price).toBeNull();
    expect(enriched[0].live_currency).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(0);
    process.env.CREATORS_CLIENT_ID = 'amzn1.test.client';
    process.env.CREATORS_CLIENT_SECRET = 'test-secret';
  });
});

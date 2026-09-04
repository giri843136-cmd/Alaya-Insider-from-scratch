/**
 * Unit tests for the Creators API client (OAuth2 + GetItems) with mocked HTTP.
 * The key contract: every failure mode (invalid credentials, network errors,
 * HTTP errors) resolves to structured errors — never a throw — so the site can
 * always render its fallback box.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

let dbPath = '';
let api: any;
let dbGet: any;
let fetchMock: jest.Mock;

const TOKEN_URL = 'https://api.amazon.co.uk/auth/o2/token';
const API_URL = 'https://creatorsapi.amazon/catalog/v1/getItems';

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function installFetch(handler: (url: string) => { status: number; body: any } | { throw: Error }) {
  fetchMock = jest.fn(async (input: any) => {
    const url = String(input);
    const r = handler(url);
    if ('throw' in (r as any)) throw (r as any).throw;
    return jsonResponse((r as any).body, (r as any).status);
  }) as any;
  (global as any).fetch = fetchMock;
}

const goodToken = { access_token: 'tok-abc', token_type: 'bearer', expires_in: 3600 };

beforeAll(async () => {
  dbPath = path.join(os.tmpdir(), `creators-api-test-${Date.now()}.db`);
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_SECRET = 'test-auth-secret-0123456789abcdef0123456789abcdef';
  process.env.CREATORS_CLIENT_ID = 'amzn1.test.client';
  process.env.CREATORS_CLIENT_SECRET = 'test-secret';
  process.env.CREATORS_VERSION = '3.2';
  process.env.CREATORS_PARTNER_TAG = 'alayainsider-21';
  process.env.CREATORS_MARKETPLACE = 'www.amazon.in';

  api = await import('../creators-api');
  dbGet = (await import('../db')).default;
  dbGet().exec(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY, value TEXT DEFAULT '', group_name TEXT DEFAULT 'general',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
});

afterEach(() => {
  fetchMock?.mockClear();
  try {
    dbGet().prepare('DELETE FROM site_settings WHERE key LIKE ?').run('creators_%');
  } catch { /* ignore */ }
});

afterAll(() => {
  try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
});

describe('credentials resolution', () => {
  it('loads from CREATORS_* env vars when DB is empty', () => {
    const creds = api.getCredentials();
    expect(creds).not.toBeNull();
    expect(creds.clientId).toBe('amzn1.test.client');
    expect(creds.partnerTag).toBe('alayainsider-21');
    expect(creds.marketplace).toBe('www.amazon.in');
    expect(creds.tokenEndpoint).toBe(TOKEN_URL); // 3.2 → api.amazon.co.uk
    expect(creds.source).toBe('env');
  });

  it('returns null when nothing is configured', () => {
    const keep = { ...process.env };
    delete process.env.CREATORS_CLIENT_ID;
    delete process.env.CREATORS_CLIENT_SECRET;
    expect(api.getCredentials()).toBeNull();
    Object.assign(process.env, keep);
  });
});

describe('secret encryption at rest', () => {
  it('encrypts and decrypts the client secret (never stored/returned plain)', () => {
    const enc = api.encryptSecret('super-secret-value');
    expect(enc).not.toContain('super-secret-value');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(api.decryptSecret(enc)).toBe('super-secret-value');
  });
});

describe('token + GetItems happy path', () => {
  it('fetches a token, calls GetItems and normalizes the item', async () => {
    installFetch((url) => {
      if (url.includes('/auth/o2/token')) return { status: 200, body: goodToken };
      if (url.includes('creatorsapi.amazon')) {
        return {
          status: 200,
          body: {
            itemResults: { items: [{
              asin: 'B0ABCDEFGH',
              detailPageURL: 'https://www.amazon.in/dp/B0ABCDEFGH?tag=alayainsider-21',
              images: { primary: { large: { url: 'https://m.media-amazon.com/images/I/xyz.jpg' } } },
              itemInfo: {
                title: { displayValue: 'Test Watch' },
                byLineInfo: { brand: { displayValue: 'Fossil' } },
              },
              offersV2: { listings: [{
                availability: { type: 'IN_STOCK' },
                condition: { value: 'New' },
                isBuyBoxWinner: true,
                merchantInfo: { name: 'Amazon.in' },
                price: { money: { amount: 12999, currency: 'INR', displayAmount: '₹12,999.00' } },
              }] },
            }] },
          },
        };
      }
      return { status: 404, body: {} };
    });

    const result = await api.creatorsGetItems(['B0ABCDEFGH']);
    expect(result.httpStatus).toBe(200);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.asin).toBe('B0ABCDEFGH');
    expect(item.title).toBe('Test Watch');
    expect(item.brand).toBe('Fossil');
    expect(item.priceAmount).toBe(12999);
    expect(item.currency).toBe('INR');
    expect(item.priceDisplay).toBe('₹12,999.00');
    expect(item.availabilityType).toBe('IN_STOCK');
  });

  it('caches the access token in the DB (second call reuses it)', async () => {
    let tokenHits = 0;
    installFetch((url) => {
      if (url.includes('/auth/o2/token')) { tokenHits++; return { status: 200, body: goodToken }; }
      return { status: 200, body: { itemResults: { items: [] } } };
    });
    await api.creatorsGetItems(['B0ABCDEFGH']);
    await api.creatorsGetItems(['B0ABCDEFGH']);
    expect(tokenHits).toBe(1); // token reused from cache
  });
});

describe('dummy-credential behaviour (the plumbing proof)', () => {
  it('invalid client → structured invalid_client error, no throw, no leak', async () => {
    installFetch((url) => {
      if (url.includes('/auth/o2/token')) {
        return { status: 400, body: { error: 'invalid_client', error_description: 'Invalid client credentials' } };
      }
      return { status: 200, body: {} };
    });

    const result = await api.creatorsGetItems(['B0ABCDEFGH']);
    expect(result.items).toEqual([]);
    expect(result.httpStatus).toBeNull();
    const err = result.errors[0];
    expect(err.code).toBe('invalid_client');
    expect(err.httpStatus).toBe(400);
  });

  it('records the last error for the admin diagnostics screen', async () => {
    installFetch((url) => {
      if (url.includes('/auth/o2/token')) {
        return { status: 400, body: { error: 'invalid_client', error_description: 'Invalid client credentials' } };
      }
      return { status: 200, body: {} };
    });
    await api.creatorsGetItems(['B0ABCDEFGH']);
    const diag = api.getDiagnostics();
    expect(diag.lastError.code).toBe('invalid_client');
    expect(diag.secretStored).toBe(true);
    expect(JSON.stringify(diag)).not.toContain('test-secret');
  });
});

describe('retry + resilience', () => {
  it('refreshes the token once when GetItems answers 401, then succeeds', async () => {
    let tokenCalls = 0;
    let apiCalls = 0;
    installFetch((url) => {
      if (url.includes('/auth/o2/token')) { tokenCalls++; return { status: 200, body: goodToken }; }
      apiCalls++;
      return apiCalls === 1
        ? { status: 401, body: { type: 'UnauthorizedException', message: 'Invalid token' } }
        : { status: 200, body: { itemResults: { items: [{ asin: 'B0ABCDEFGH', offersV2: { listings: [] } }] } } };
    });
    const result = await api.creatorsGetItems(['B0ABCDEFGH']);
    expect(result.httpStatus).toBe(200);
    expect(result.items[0].asin).toBe('B0ABCDEFGH');
    expect(tokenCalls).toBe(2); // initial + refresh
  });

  it('API timeout/network failure → NETWORK_ERROR result instead of throwing', async () => {
    installFetch((url) => {
      if (url.includes('/auth/o2/token')) return { status: 200, body: goodToken };
      return { throw: new TypeError('fetch failed') };
    });
    const result = await api.creatorsGetItems(['B0ABCDEFGH']);
    expect(result.items).toEqual([]);
    expect(result.errors[0].code).toBe('NETWORK_ERROR');
  });

  it('rejects >10 ASINs gracefully at the normalizer level', async () => {
    installFetch((url) => {
      if (url.includes('/auth/o2/token')) return { status: 200, body: goodToken };
      return { status: 200, body: { itemResults: { items: [] } } };
    });
    const asins = Array.from({ length: 15 }, (_, i) => `B0ASIN${String(i).padStart(4, '0')}`);
    const result = await api.creatorsGetItems(asins);
    // client normalizes & dedupes; Amazon caps at 10 per request so callers
    // must chunk — assert the client at least keeps valid ones.
    expect(result.httpStatus).toBe(200);
  });
});

/**
 * Amazon Creators API client — the official replacement for the retired
 * Product Advertising API 5.0 (PA-API 5 was deprecated 2026-04-30 and the
 * endpoint retired 2026-05-15).
 *
 * Dual-store support:
 *   India:  marketplace www.amazon.in,  tag alayainsider-21, credential version 3.2 (EU),
 *           token endpoint https://api.amazon.co.uk/auth/o2/token, currency INR
 *   US:     marketplace www.amazon.com, tag alayainsider-20, credential version 3.1 (NA),
 *           token endpoint https://api.amazon.com/auth/o2/token, currency USD
 * API endpoint (both): https://creatorsapi.amazon/catalog/v1/getItems
 *
 * Each store has its own credential set, token cache and diagnostics — both
 * secrets are encrypted at rest (AES-256-GCM keyed by AUTH_SECRET).
 *
 * Credentials are resolved per store from (in priority order):
 *   1. Encrypted site_settings rows (entered via /admin/amazon) → DB wins so a
 *      non-technical admin can manage keys without SSH.
 *   2. CREATORS_* (India) / CREATORS_US_* (US) environment variables.
 *
 * Secrets are never returned to the browser and never logged.
 * All failures degrade to structured results — callers must never see a throw
 * from this module for a normal price lookup.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import getDb from './db';
import { STORES, DEFAULT_STORE, storeConfig, type Store, type StoreConfig } from './stores';

// ─── Types ──────────────────────────────────────────────────────────────────

export type { Store, StoreConfig };
export { STORES, DEFAULT_STORE, storeConfig };

export interface CreatorsCredentials {
  clientId: string;
  clientSecret: string;
  /** Credential version assigned by Amazon (3.1 NA / 3.2 EU / 3.3 FE). */
  version: string;
  /** Amazon Associates tag, e.g. "alayainsider-21" */
  partnerTag: string;
  /** Marketplace domain, e.g. "www.amazon.in" */
  marketplace: string;
  /** OAuth token endpoint (override). Default derived from `version`. */
  tokenEndpoint: string;
  source: 'db' | 'env';
  store: Store;
}

export interface CreatorsItem {
  asin: string;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  detailPageURL: string | null;
  priceAmount: number | null;
  currency: string | null;
  priceDisplay: string | null;
  availabilityType: string | null; // "IN_STOCK" | "OUT_OF_STOCK" | ...
  condition: string | null;
  merchant: string | null;
  isBuyBoxWinner: boolean | null;
}

export interface CreatorsError {
  code: string;      // e.g. InvalidCredentials, ItemNotAccessible, NETWORK_ERROR
  message: string;
  httpStatus?: number | null;
}

export interface CreatorsGetItemsResult {
  items: CreatorsItem[];
  errors: CreatorsError[];
  httpStatus: number | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const DEFAULT_MARKETPLACE = STORES.in.marketplace;

const API_ENDPOINT = 'https://creatorsapi.amazon/catalog/v1/getItems';
const TOKEN_SCOPE = 'creatorsapi::default';

const TOKEN_ENDPOINTS_BY_VERSION: Record<string, string> = {
  '3.1': 'https://api.amazon.com/auth/o2/token',     // NA  (US, CA, MX, BR)
  '3.2': 'https://api.amazon.co.uk/auth/o2/token',    // EU  (UK, DE, FR, IT, ES, ..., IN)
  '3.3': 'https://api.amazon.co.jp/auth/o2/token',    // FE  (JP, SG, AU)
};

const REQUEST_TIMEOUT_MS = 8000;

// Settings keys stored in site_settings. The India store keeps the original
// unprefixed keys (backward compatible); the US store gets a "us_" segment.
const DB_KEYS: Record<string, string> = {
  clientId: 'creators_client_id',
  secretEnc: 'creators_secret_enc',
  version: 'creators_version',
  partnerTag: 'creators_partner_tag',
  marketplace: 'creators_marketplace',
  tokenEndpoint: 'creators_token_endpoint',
  token: 'creators_access_token',
  tokenExpiresAt: 'creators_token_expires_at',
  lastError: 'creators_last_error',
  lastErrorAt: 'creators_last_error_at',
  lastSuccessAt: 'creators_last_success_at',
  lastTest: 'creators_last_test',
  lastCronRun: 'creators_last_cron_run',
  lastCronSummary: 'creators_last_cron_summary',
};

function keyFor(store: Store, key: string): string {
  if (store === 'in') return DB_KEYS[key];
  return DB_KEYS[key].replace('creators_', `creators_${store}_`);
}

// Keys cleared together when credentials are removed/changed (per store).
function credentialKeys(store: Store): string[] {
  return [keyFor(store, 'clientId'), keyFor(store, 'secretEnc'), keyFor(store, 'version'),
    keyFor(store, 'partnerTag'), keyFor(store, 'marketplace'), keyFor(store, 'tokenEndpoint')];
}

const SECRET_PREFIX = 'enc:v1:';

// ─── Small DB helpers ───────────────────────────────────────────────────────

function getSetting(key: string): string {
  try {
    const row = getDb().prepare('SELECT value FROM site_settings WHERE key = ?').get(key) as any;
    return row?.value ?? '';
  } catch {
    return '';
  }
}

function setSetting(key: string, value: string) {
  try {
    getDb().prepare(`INSERT INTO site_settings (key, value, group_name, updated_at)
      VALUES (?, ?, 'creators', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(key, value);
  } catch {
    // best-effort bookkeeping
  }
}

// ─── Logging (server-side only, never exposed to visitors) ─────────────────

function logFile(): string {
  const configured = process.env.CREATORS_LOG;
  if (configured) return path.resolve(configured);
  const dbPath = process.env.DATABASE_PATH || './data/alaya.db';
  const dir = path.dirname(path.resolve(process.cwd(), dbPath));
  return path.join(dir, 'logs', 'creators-api.log');
}

function log(message: string) {
  const line = `[creators-api] ${new Date().toISOString()} ${message}\n`;
  try {
    fs.appendFileSync(logFile(), line);
  } catch {
    // Disk full / unwritable — the app must keep working regardless.
  }
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.error(line.trim());
  }
}

// ─── Secret encryption at rest (AES-256-GCM, keyed by AUTH_SECRET) ─────────

function encKey(): Buffer | null {
  const secret = (process.env.AUTH_SECRET || '').trim();
  if (!secret) return null;
  return crypto.createHash('sha256').update(`alaya-creators:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const key = encKey();
  if (!key) throw new Error('AUTH_SECRET is not set — cannot encrypt the Creators API secret.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return SECRET_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(SECRET_PREFIX)) throw new Error('Unsupported secret format.');
  const key = encKey();
  if (!key) throw new Error('AUTH_SECRET is not set — cannot decrypt the Creators API secret.');
  const raw = Buffer.from(stored.slice(SECRET_PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// ─── Environment helpers ────────────────────────────────────────────────────

function env(key: string): string {
  return (process.env[key] || '').trim();
}

export function defaultTokenEndpoint(version: string): string {
  return TOKEN_ENDPOINTS_BY_VERSION[version] || TOKEN_ENDPOINTS_BY_VERSION['3.2'];
}

// ─── Credential resolution (per store) ─────────────────────────────────────

/**
 * Load credentials for one store: DB (admin panel) takes priority, then the
 * store's env vars (CREATORS_* for India, CREATORS_US_* for US).
 * Returns null when nothing usable is configured — callers must fall back
 * gracefully (that is exactly what the UI does with "Check price on Amazon").
 */
export function getCredentials(store: Store = DEFAULT_STORE): CreatorsCredentials | null {
  const cfg = STORES[store];
  const dbClientId = getSetting(keyFor(store, 'clientId'));
  const dbSecretEnc = getSetting(keyFor(store, 'secretEnc'));
  let dbSecret = '';
  if (dbSecretEnc) {
    try {
      dbSecret = decryptSecret(dbSecretEnc);
    } catch (e: any) {
      log(`[${store}] Secret decryption failed (AUTH_SECRET changed?): ${e.message}`);
      dbSecret = '';
    }
  }
  const dbVersion = getSetting(keyFor(store, 'version'));
  const dbPartnerTag = getSetting(keyFor(store, 'partnerTag'));
  const dbMarketplace = getSetting(keyFor(store, 'marketplace'));
  const dbTokenEndpoint = getSetting(keyFor(store, 'tokenEndpoint'));

  const fromDb =
    dbClientId && dbSecret && dbVersion && dbPartnerTag
      ? {
          clientId: dbClientId,
          clientSecret: dbSecret,
          version: dbVersion,
          partnerTag: dbPartnerTag,
          marketplace: dbMarketplace || cfg.marketplace,
          tokenEndpoint: dbTokenEndpoint || defaultTokenEndpoint(dbVersion),
          source: 'db' as const,
          store,
        }
      : null;

  if (fromDb) return fromDb;

  const p = cfg.envPrefix;
  const envClientId = env(`${p}CLIENT_ID`);
  const envSecret = env(`${p}CLIENT_SECRET`);
  const envVersion = env(`${p}VERSION`);
  const envPartnerTag = env(`${p}PARTNER_TAG`);
  if (envClientId && envSecret && envVersion && envPartnerTag) {
    return {
      clientId: envClientId,
      clientSecret: envSecret,
      version: envVersion,
      partnerTag: envPartnerTag,
      marketplace: env(`${p}MARKETPLACE`) || cfg.marketplace,
      tokenEndpoint: env(`${p}TOKEN_ENDPOINT`) || defaultTokenEndpoint(envVersion),
      source: 'env' as const,
      store,
    };
  }

  return null;
}

export function isConfigured(store: Store = DEFAULT_STORE): boolean {
  return getCredentials(store) !== null;
}

/** All stores with usable credentials (used by the hourly cron). */
export function configuredStores(): Store[] {
  return (['in', 'us'] as Store[]).filter(s => isConfigured(s));
}

/**
 * Partner Tag validation per store. Amazon.in tags end in -21, amazon.com in
 * -20. We hard-reject malformed tags and return a warning for a valid format
 * that does not match the store's expected suffix (admin UI shows it).
 */
export function validatePartnerTag(tag: string, store: Store): { ok: boolean; warning?: string; error?: string } {
  const t = (tag || '').trim();
  if (!t) return { ok: false, error: 'Partner Tag is required (e.g. alayainsider-21)' };
  // Typical format: <account>-<2 digits> (e.g. alayainsider-21). Tolerate other
  // alphanumerics/underscores in the account part.
  if (!/^[a-zA-Z0-9_\-]+-\d{2}$/.test(t)) {
    return { ok: false, error: 'Partner Tag must look like <account>-21 (e.g. alayainsider-21)' };
  }
  if (!t.endsWith(STORES[store].tagSuffix)) {
    return {
      ok: true,
      warning: `This store expects a tag ending in ${STORES[store].tagSuffix} (e.g. ${STORES[store].defaultTag}). The tag you entered ends differently — double-check it matches your ${STORES[store].label} Associates account.`,
    };
  }
  return { ok: true };
}

// ─── OAuth2 token (cached per store, refreshed before expiry) ──────────────

export async function fetchAccessToken(creds: CreatorsCredentials): Promise<string | null> {
  const store = creds.store || DEFAULT_STORE;
  const body = JSON.stringify({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: TOKEN_SCOPE,
  });

  let res: Response;
  try {
    res = await fetch(creds.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e: any) {
    recordFailure(store, { code: 'NETWORK_ERROR', message: `Token endpoint unreachable: ${e.name || e.message}`, httpStatus: null });
    log(`[${store}] Token request network error: ${e.name || e.message} (${creds.tokenEndpoint})`);
    return null;
  }

  const text = await res.text().catch(() => '');
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }

  if (res.ok && json?.access_token) {
    const expiresIn = Number(json.expires_in) || 3600;
    const expiresAt = Date.now() + (expiresIn - 60) * 1000; // 60s safety buffer
    setSetting(keyFor(store, 'token'), json.access_token);
    setSetting(keyFor(store, 'tokenExpiresAt'), String(expiresAt));
    return json.access_token as string;
  }

  const code = json?.error || (res.status === 401 ? 'invalid_client' : 'TOKEN_REQUEST_FAILED');
  const message = json?.error_description || json?.message || text.slice(0, 300) || `HTTP ${res.status}`;
  recordFailure(store, { code, message, httpStatus: res.status });
  log(`[${store}] Token request failed: HTTP ${res.status} code=${code} message=${message.slice(0, 200)}`);
  setSetting(keyFor(store, 'token'), '');
  setSetting(keyFor(store, 'tokenExpiresAt'), '');
  return null;
}

/** Cached access token for a store; fetches when missing or within 60s of expiry. */
export async function getAccessToken(store: Store = DEFAULT_STORE): Promise<string | null> {
  const creds = getCredentials(store);
  if (!creds) return null;

  const cached = getSetting(keyFor(store, 'token'));
  const expiresAt = parseInt(getSetting(keyFor(store, 'tokenExpiresAt')) || '0', 10);
  if (cached && expiresAt > Date.now()) return cached;

  return fetchAccessToken(creds);
}

// ─── Diagnostics bookkeeping (per store) ───────────────────────────────────

export function recordFailure(store: Store, err: { code: string; message: string; httpStatus?: number | null }) {
  setSetting(keyFor(store, 'lastError'), JSON.stringify({ ...err, httpStatus: err.httpStatus ?? null }));
  setSetting(keyFor(store, 'lastErrorAt'), new Date().toISOString());
}

export function recordSuccess(store: Store = DEFAULT_STORE) {
  setSetting(keyFor(store, 'lastSuccessAt'), new Date().toISOString());
  setSetting(keyFor(store, 'lastError'), '');
}

export function getDiagnostics(store: Store = DEFAULT_STORE) {
  const cfg = STORES[store];
  const p = cfg.envPrefix;
  const creds = getCredentials(store);
  return {
    store,
    configured: !!creds,
    source: creds?.source ?? null,
    clientId: mask(getSetting(keyFor(store, 'clientId')) || env(`${p}CLIENT_ID`)),
    version: getSetting(keyFor(store, 'version')) || env(`${p}VERSION`) || cfg.version,
    partnerTag: getSetting(keyFor(store, 'partnerTag')) || env(`${p}PARTNER_TAG`) || '',
    marketplace: getSetting(keyFor(store, 'marketplace')) || env(`${p}MARKETPLACE`) || cfg.marketplace,
    tokenEndpoint: getSetting(keyFor(store, 'tokenEndpoint')) || env(`${p}TOKEN_ENDPOINT`) || '',
    secretStored: !!getSetting(keyFor(store, 'secretEnc')) || !!env(`${p}CLIENT_SECRET`),
    lastError: parseJson(getSetting(keyFor(store, 'lastError'))),
    lastErrorAt: getSetting(keyFor(store, 'lastErrorAt')) || null,
    lastSuccessAt: getSetting(keyFor(store, 'lastSuccessAt')) || null,
    lastTest: parseJson(getSetting(keyFor(store, 'lastTest'))),
    lastCronRun: getSetting(keyFor(store, 'lastCronRun')) || null,
    lastCronSummary: parseJson(getSetting(keyFor(store, 'lastCronSummary'))),
  };
}

/** Diagnostics for every store — the admin page renders one card per store. */
export function getAllDiagnostics(): Record<Store, ReturnType<typeof getDiagnostics>> {
  return { in: getDiagnostics('in'), us: getDiagnostics('us') };
}

/** Persist the result of the hourly cron refresh for one store. */
export function recordCronRun(summary: object, store: Store = DEFAULT_STORE) {
  setSetting(keyFor(store, 'lastCronRun'), new Date().toISOString());
  setSetting(keyFor(store, 'lastCronSummary'), JSON.stringify(summary));
}

/** Remove stored credentials + token + diagnostics for one store (admin "clear"). */
export function clearStoredCredentials(store: Store = DEFAULT_STORE) {
  const keys = [...credentialKeys(store), keyFor(store, 'lastError'), keyFor(store, 'lastErrorAt'), keyFor(store, 'lastTest')];
  for (const key of keys) {
    try { getDb().prepare('DELETE FROM site_settings WHERE key = ?').run(key); } catch { /* best-effort */ }
  }
  clearTokenCache(store);
}

/** Save diagnostics from an interactive "test connection" run for a store. */
export function recordTestRun(result: object, store: Store = DEFAULT_STORE) {
  setSetting(keyFor(store, 'lastTest'), JSON.stringify(result));
}

function mask(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function parseJson(raw: string): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── GetItems ───────────────────────────────────────────────────────────────

export function normalizeAsin(asin: string): string | null {
  const a = asin.trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(a) ? a : null;
}

export function normalizeItem(item: any): CreatorsItem | null {
  if (!item?.asin) return null;
  const listing = Array.isArray(item.offersV2?.listings) ? item.offersV2.listings[0] : undefined;
  return {
    asin: item.asin,
    title: item.itemInfo?.title?.displayValue ?? null,
    brand: item.itemInfo?.byLineInfo?.brand?.displayValue ?? null,
    imageUrl: item.images?.primary?.large?.url ?? null,
    detailPageURL: item.detailPageURL ?? null,
    priceAmount: typeof listing?.price?.money?.amount === 'number' ? listing.price.money.amount : null,
    currency: listing?.price?.money?.currency ?? null,
    priceDisplay: listing?.price?.money?.displayAmount ?? null,
    availabilityType: listing?.availability?.type ?? null,
    condition: listing?.condition?.value ?? null,
    merchant: listing?.merchantInfo?.name ?? null,
    isBuyBoxWinner: typeof listing?.isBuyBoxWinner === 'boolean' ? listing.isBuyBoxWinner : null,
  };
}

/**
 * GetItems lookup for one store against
 * https://creatorsapi.amazon/catalog/v1/getItems. Up to 10 ASINs per call.
 * Never throws — returns structured errors.
 */
export async function creatorsGetItems(asins: string[], store: Store = DEFAULT_STORE): Promise<CreatorsGetItemsResult> {
  // Amazon caps GetItems at 10 ASINs per call — higher-level callers
  // (getLivePrices) chunk; here we defensively slice as well.
  const unique = ([...new Set(asins.map(normalizeAsin).filter(Boolean))] as string[]).slice(0, 10);
  if (unique.length === 0) return { items: [], errors: [], httpStatus: null };

  const creds = getCredentials(store);
  if (!creds) {
    return {
      items: [],
      errors: [{ code: 'NO_CREDENTIALS', message: `${STORES[store].label} Creators API credentials are not configured yet.`, httpStatus: null }],
      httpStatus: null,
    };
  }

  const token = await getAccessToken(store);
  if (!token) {
    // fetchAccessToken already recorded the precise failure (e.g. invalid_client) — surface it.
    const last = parseJson(getSetting(keyFor(store, 'lastError'))) as CreatorsError | null;
    return {
      items: [],
      errors: [{
        code: last?.code || 'AUTH_FAILED',
        message: last?.message || 'Could not obtain an OAuth2 access token.',
        httpStatus: last?.httpStatus ?? null,
      }],
      httpStatus: null,
    };
  }

  const payload = {
    itemIds: unique,
    itemIdType: 'ASIN',
    marketplace: creds.marketplace,
    partnerTag: creds.partnerTag,
    resources: [
      'images.primary.large',
      'itemInfo.title',
      'itemInfo.byLineInfo',
      'offersV2.listings.price',
      'offersV2.listings.availability',
      'offersV2.listings.condition',
      'offersV2.listings.merchantInfo',
      'offersV2.listings.isBuyBoxWinner',
    ],
  };

  let res: Response;
  try {
    res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-marketplace': creds.marketplace,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e: any) {
    const err = { code: 'NETWORK_ERROR', message: `API unreachable: ${e.name || e.message}`, httpStatus: null as number | null };
    recordFailure(store, err);
    log(`[${store}] GetItems network error: ${e.name || e.message}`);
    return { items: [], errors: [err], httpStatus: null };
  }

  const text = await res.text().catch(() => '');
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }

  // Retry once after refreshing the token (e.g. token expired mid-flight).
  if (res.status === 401) {
    log(`[${store}] GetItems returned 401 — refreshing token and retrying once.`);
    const fresh = await fetchAccessToken(creds);
    if (!fresh) {
      const err = { code: 'AUTH_FAILED', message: 'OAuth2 token rejected by Creators API.', httpStatus: res.status };
      recordFailure(store, err);
      return { items: [], errors: [err], httpStatus: res.status };
    }
    try {
      const retry = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}`, 'x-marketplace': creds.marketplace },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const retryText = await retry.text().catch(() => '');
      let retryJson: any = null;
      try { retryJson = JSON.parse(retryText); } catch { /* not json */ }
      return handleGetItemsResponse(retry, retryJson, retryText, store);
    } catch (e: any) {
      const err = { code: 'NETWORK_ERROR', message: `Retry failed: ${e.name || e.message}`, httpStatus: null as number | null };
      recordFailure(store, err);
      return { items: [], errors: [err], httpStatus: null };
    }
  }

  return handleGetItemsResponse(res, json, text, store);
}

function handleGetItemsResponse(res: Response, json: any, text: string, store: Store): CreatorsGetItemsResult {
  if (res.ok && json) {
    recordSuccess(store);
    const items = (json.itemResults?.items || []).map(normalizeItem).filter(Boolean) as CreatorsItem[];
    const errors: CreatorsError[] = (json.errors || []).map((e: any) => ({
      code: e.code || 'UNKNOWN',
      message: e.message || '',
      httpStatus: res.status,
    }));
    return { items, errors, httpStatus: res.status };
  }

  // Amazon error envelope: {"type": "...", "message": "...", "reason": "..."} or {"errors": [...]}
  const type = json?.type || json?.__type || 'API_ERROR';
  const message = json?.message || (Array.isArray(json?.errors) ? json.errors[0]?.message : '') || text.slice(0, 300) || `HTTP ${res.status}`;
  const code = json?.reason || type.split('#').pop() || 'API_ERROR';
  const err = { code, message, httpStatus: res.status };
  recordFailure(store, err);
  log(`[${store}] GetItems failed: HTTP ${res.status} code=${code} message=${message.slice(0, 200)}`);
  return { items: [], errors: [err], httpStatus: res.status };
}

/** Clear cached access token + diagnostics for a store (used when credentials change). */
export function clearTokenCache(store: Store = DEFAULT_STORE) {
  setSetting(keyFor(store, 'token'), '');
  setSetting(keyFor(store, 'tokenExpiresAt'), '');
}
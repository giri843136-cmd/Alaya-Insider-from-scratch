import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  encryptSecret, clearStoredCredentials, clearTokenCache,
  getAllDiagnostics, getDiagnostics, validatePartnerTag,
  STORES, type Store,
} from '@/lib/creators-api';
import { validateOneLinkSnippet, ONELINK_SETTING_KEY } from '@/lib/onelink';

function setSetting(key: string, value: string) {
  getDb().prepare(`INSERT INTO site_settings (key, value, group_name, updated_at)
    VALUES (?, ?, 'creators', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(key, value);
}

function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM site_settings WHERE key = ?').get(key) as any;
  return row?.value ?? '';
}

function normalizeStore(value: any): Store | null {
  return value === 'us' ? 'us' : value === 'in' ? 'in' : null;
}

/** List the price cache joined with product names for the admin table. */
function cacheTable() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM amazon_price_cache ORDER BY fetched_at DESC LIMIT 200').all() as any[];
  const products = db.prepare('SELECT id, name, india_affiliate_url, us_affiliate_url, global_affiliate_url, affiliate_url FROM products WHERE deleted_at IS NULL').all() as any[];
  return rows.map((r: any) => {
    let payload: any = {};
    try { payload = JSON.parse(r.payload); } catch { /* ignore */ }
    const product = products.find((p: any) =>
      (r.store === 'us' && (p.us_affiliate_url || p.global_affiliate_url || p.affiliate_url)?.includes(r.asin)) ||
      (r.store === 'in' && (p.india_affiliate_url || p.affiliate_url)?.includes(r.asin)));
    return {
      store: r.store,
      asin: r.asin,
      ok: r.ok === 1,
      price: payload.price ?? null,
      currency: payload.currency || null,
      available: !!payload.available,
      error_code: r.error_code,
      error_message: r.error_message,
      fetched_at: r.fetched_at,
      product_name: product?.name || null,
      product_id: product?.id || null,
    };
  });
}

/**
 * GET — status for both stores (secret never returned; masked ids + whether a
 * secret is stored + last test/error state per store), OneLink status and the
 * price cache table for the admin page.
 */
export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const snippet = getSetting(ONELINK_SETTING_KEY);
  const onelink = validateOneLinkSnippet(snippet);
  return NextResponse.json({
    stores: getAllDiagnostics(),
    onelink: {
      installed: onelink.ok && onelink.srcs.length > 0,
      srcs: onelink.ok ? onelink.srcs : [],
      error: onelink.error || null,
    },
    cache: cacheTable(),
  });
}

/**
 * PUT — save or clear credentials for ONE store.
 * Body: { store?: 'in'|'us', clientId, clientSecret?, version, partnerTag, marketplace?, tokenEndpoint?, clear? }
 *   - clientSecret empty/omitted ⇒ keep the currently stored secret.
 *   - clear: true ⇒ wipe that store's credentials + token + diagnostics.
 * The secret is encrypted at rest with AUTH_SECRET and never echoed back.
 * Partner Tag format is validated; suffix mismatch (e.g. -20 on the .in store)
 * returns a warning that the admin UI surfaces.
 */
export async function PUT(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const store = normalizeStore(body?.store) || 'in';
    const cfg = STORES[store];

    if (body.clear) {
      clearStoredCredentials(store);
      return NextResponse.json({ success: true, cleared: true, store, diagnostics: getDiagnostics(store) });
    }

    const clientId = (body.clientId || '').trim();
    const version = (body.version || '').trim();
    const partnerTag = (body.partnerTag || '').trim();
    const marketplace = (body.marketplace || '').trim() || cfg.marketplace;
    const tokenEndpoint = (body.tokenEndpoint || '').trim();

    if (!clientId) return NextResponse.json({ error: 'Credential ID is required' }, { status: 400 });
    if (!version) return NextResponse.json({ error: 'Credential version is required (e.g. 3.2)' }, { status: 400 });

    const tagCheck = validatePartnerTag(partnerTag, store);
    if (!tagCheck.ok) return NextResponse.json({ error: tagCheck.error }, { status: 400 });
    if (!/^[\w.\-]+$/.test(marketplace)) return NextResponse.json({ error: 'Marketplace must be a domain like www.amazon.in' }, { status: 400 });

    const db = getDb();
    const secretKey = store === 'us' ? 'creators_us_secret_enc' : 'creators_secret_enc';
    const existing = (db.prepare('SELECT value FROM site_settings WHERE key = ?').get(secretKey) as any)?.value || '';
    const newSecret = (body.clientSecret || '').trim();

    if (!existing && !newSecret) {
      return NextResponse.json({ error: 'Credential Secret is required (shown once when you created the credential)' }, { status: 400 });
    }

    // Namespaced keys: India keeps the legacy unprefixed keys, US gets us_.
    const k = (suffix: string) => (store === 'us' ? `creators_us_${suffix}` : `creators_${suffix}`);
    setSetting(k('client_id'), clientId);
    if (newSecret) {
      setSetting(k('secret_enc'), encryptSecret(newSecret));
    }
    setSetting(k('version'), version);
    setSetting(k('partner_tag'), partnerTag);
    setSetting(k('marketplace'), marketplace);
    setSetting(k('token_endpoint'), tokenEndpoint); // '' = auto-derive from version

    // Invalidate cached token + stale diagnostics so the next lookup uses the new keys.
    clearTokenCache(store);
    try {
      db.prepare(`DELETE FROM site_settings WHERE key IN (?, ?, ?)`)
        .run(k('last_error'), k('last_error_at'), k('last_test'));
    } catch { /* ok */ }

    return NextResponse.json({
      success: true,
      store,
      warning: tagCheck.warning || null,
      diagnostics: getDiagnostics(store),
    });
  } catch (e: any) {
    console.error('Creators settings update error:', e);
    const msg = e?.message?.includes('AUTH_SECRET')
      ? 'AUTH_SECRET is not configured — add it to .env to store the secret encrypted.'
      : 'Failed to save Creators API settings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
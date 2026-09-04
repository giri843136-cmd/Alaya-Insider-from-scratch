import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  encryptSecret, clearStoredCredentials, clearTokenCache,
  getDiagnostics, DEFAULT_MARKETPLACE,
} from '@/lib/creators-api';

function setSetting(key: string, value: string) {
  getDb().prepare(`INSERT INTO site_settings (key, value, group_name, updated_at)
    VALUES (?, ?, 'creators', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(key, value);
}

/**
 * GET — status only. The secret is NEVER returned; client sees a masked id,
 * whether a secret is stored, and last test/error state.
 */
export async function GET() {
  ensureDbReady();
  return NextResponse.json({ diagnostics: getDiagnostics() });
}

/**
 * PUT — save or clear credentials.
 * Body: { clientId, clientSecret?, version, partnerTag, marketplace?, tokenEndpoint?, clear? }
 *   - clientSecret empty/omitted ⇒ keep the currently stored secret.
 *   - clear: true ⇒ wipe stored credentials + token + diagnostics.
 * The secret is encrypted at rest with AUTH_SECRET and never echoed back.
 */
export async function PUT(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    if (body.clear) {
      clearStoredCredentials();
      return NextResponse.json({ success: true, cleared: true, diagnostics: getDiagnostics() });
    }

    const clientId = (body.clientId || '').trim();
    const version = (body.version || '').trim();
    const partnerTag = (body.partnerTag || '').trim();
    const marketplace = (body.marketplace || '').trim() || DEFAULT_MARKETPLACE;
    const tokenEndpoint = (body.tokenEndpoint || '').trim();

    if (!clientId) return NextResponse.json({ error: 'Credential ID is required' }, { status: 400 });
    if (!version) return NextResponse.json({ error: 'Credential version is required (e.g. 3.2)' }, { status: 400 });
    if (!partnerTag) return NextResponse.json({ error: 'Partner Tag is required (e.g. alayainsider-21)' }, { status: 400 });
    if (!/^[\w.\-]+$/.test(marketplace)) return NextResponse.json({ error: 'Marketplace must be a domain like www.amazon.in' }, { status: 400 });

    const db = getDb();
    const existing = (db.prepare("SELECT value FROM site_settings WHERE key = 'creators_secret_enc'").get() as any)?.value || '';
    const newSecret = (body.clientSecret || '').trim();

    if (!existing && !newSecret) {
      return NextResponse.json({ error: 'Credential Secret is required (shown once when you created the credential)' }, { status: 400 });
    }

    setSetting('creators_client_id', clientId);
    if (newSecret) {
      setSetting('creators_secret_enc', encryptSecret(newSecret));
    }
    setSetting('creators_version', version);
    setSetting('creators_partner_tag', partnerTag);
    setSetting('creators_marketplace', marketplace);
    setSetting('creators_token_endpoint', tokenEndpoint); // '' = auto-derive from version

    // Invalidate cached token + stale diagnostics so the next lookup uses the new keys.
    clearTokenCache();
    try { db.prepare("DELETE FROM site_settings WHERE key IN ('creators_last_error','creators_last_error_at','creators_last_test')").run(); } catch { /* ok */ }

    return NextResponse.json({ success: true, diagnostics: getDiagnostics() });
  } catch (e: any) {
    console.error('Creators settings update error:', e);
    const msg = e?.message?.includes('AUTH_SECRET')
      ? 'AUTH_SECRET is not configured — add it to .env to store the secret encrypted.'
      : 'Failed to save Creators API settings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

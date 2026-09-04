import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import { getAuthUser } from '@/lib/auth';
import {
  creatorsGetItems, getDiagnostics, recordTestRun, clearTokenCache, normalizeAsin, STORES, type Store,
} from '@/lib/creators-api';

function normalizeStore(value: any): Store | null {
  return value === 'us' ? 'us' : value === 'in' ? 'in' : null;
}

/**
 * POST — run a live plumbing test against the Creators API for ONE store with
 * the currently stored credentials. Used by /admin/amazon as the per-store
 * "health check": it reports the exact HTTP status + error body Amazon returns.
 *
 * With intentionally-dummy credentials the expected outcome is an OAuth error
 * (invalid_client / UnauthorizedException) from the store's token endpoint —
 * that proves the request pipeline works end-to-end. Real credentials should
 * return item data with prices.
 *
 * Body: { store?: 'in'|'us', asins?: string[], force?: boolean }
 */
export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const store = normalizeStore(body?.store) || 'in';
    const provided = Array.isArray(body?.asins) ? body.asins : [];
    const asins = [...new Set(provided.map(normalizeAsin).filter(Boolean) as string[])];
    const force = !!body?.force; // if true, also refresh the cached token first

    if (asins.length === 0) {
      return NextResponse.json({ error: `Provide at least one valid 10-character ASIN to test (${STORES[store].marketplace}).` }, { status: 400 });
    }
    if (asins.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 ASINs per test call' }, { status: 400 });
    }

    if (force) clearTokenCache(store);

    const result = await creatorsGetItems(asins, store);

    const response = {
      store,
      testedAt: new Date().toISOString(),
      asins,
      httpStatus: result.httpStatus,
      errors: result.errors,
      items: result.items,
      // Only ever expose masked/derived credential info, never the secret.
      diagnostics: {
        configured: getDiagnostics(store).configured,
        source: getDiagnostics(store).source,
        partnerTag: getDiagnostics(store).partnerTag,
        marketplace: getDiagnostics(store).marketplace,
      },
    };

    recordTestRun(response, store);
    return NextResponse.json(response);
  } catch (e: any) {
    console.error('Creators test error:', e);
    return NextResponse.json({ error: 'Test failed unexpectedly: ' + (e?.message || e) }, { status: 500 });
  }
}
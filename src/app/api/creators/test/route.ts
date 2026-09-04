import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import { getAuthUser } from '@/lib/auth';
import {
  creatorsGetItems, getDiagnostics, recordTestRun, clearTokenCache, normalizeAsin,
} from '@/lib/creators-api';

/**
 * POST — run a live plumbing test against the Creators API with the currently
 * stored credentials. Used by /admin/amazon as the "health check": it reports
 * the exact HTTP status + error body Amazon returns.
 *
 * With intentionally-dummy credentials the expected outcome is an OAuth error
 * (invalid_client / UnauthorizedException) from the token endpoint — that
 * proves the request pipeline works end-to-end. Real credentials should return
 * item data with prices.
 *
 * Body: { asins?: string[] }  (default: the three standard verification ASINs)
 */
export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const provided = Array.isArray(body?.asins) ? body.asins : [];
    const asins = [...new Set(provided.map(normalizeAsin).filter(Boolean) as string[])];
    const force = !!body?.force; // if true, also refresh the cached token first

    if (asins.length === 0) {
      return NextResponse.json({ error: 'Provide at least one valid 10-character ASIN to test' }, { status: 400 });
    }
    if (asins.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 ASINs per test call' }, { status: 400 });
    }

    if (force) clearTokenCache();

    const result = await creatorsGetItems(asins);

    const response = {
      testedAt: new Date().toISOString(),
      asins,
      httpStatus: result.httpStatus,
      errors: result.errors,
      items: result.items,
      // Only ever expose masked/derived credential info, never the secret.
      diagnostics: {
        configured: getDiagnostics().configured,
        source: getDiagnostics().source,
        partnerTag: getDiagnostics().partnerTag,
        marketplace: getDiagnostics().marketplace,
      },
    };

    recordTestRun(response);
    return NextResponse.json(response);
  } catch (e: any) {
    console.error('Creators test error:', e);
    return NextResponse.json({ error: 'Test failed unexpectedly: ' + (e?.message || e) }, { status: 500 });
  }
}

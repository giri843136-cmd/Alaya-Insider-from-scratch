import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import { getAuthUser } from '@/lib/auth';
import { getLivePrice } from '@/lib/amazon-price';
import { normalizeAsin, type Store } from '@/lib/creators-api';

function normalizeStore(value: any): Store | null {
  return value === 'us' ? 'us' : value === 'in' ? 'in' : null;
}

/**
 * POST — force-refresh a single (store, asin) cache row from the admin
 * "Cached prices" table's per-row refresh button.
 * Body: { store: 'in'|'us', asin: string }  — optionally a productId to log.
 */
export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const store = normalizeStore(body?.store) || 'in';
    const asin = normalizeAsin(String(body?.asin || ''));
    if (!asin) return NextResponse.json({ error: 'Provide a valid 10-character ASIN' }, { status: 400 });

    const live = await getLivePrice(asin, store);
    return NextResponse.json({
      success: true,
      store,
      asin,
      price: live.price,
      currency: live.currency,
      available: live.available,
      fetchedAt: live.fetchedAt,
    });
  } catch (e: any) {
    console.error('Cache refresh error:', e);
    return NextResponse.json({ error: 'Refresh failed: ' + (e?.message || e) }, { status: 500 });
  }
}
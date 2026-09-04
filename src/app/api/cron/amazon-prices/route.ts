import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getLivePrices, productIndiaAsin, productUsAsin } from '@/lib/amazon-price';
import { recordCronRun, configuredStores, getAllDiagnostics, type Store } from '@/lib/creators-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Hourly Amazon price refresh for BOTH configured stores (amazon.in + the US
 * store when credentials exist). Trigger it from an external cron service
 * (cron-job.org, UptimeRobot, server cron) with:
 *
 *   POST https://alayainsider.com/api/cron/amazon-prices
 *   Header: x-cron-secret: <CRON_SECRET from .env>
 *
 * Admin users may also call it directly (session/bearer auth) — that is what
 * the "Refresh all prices now" button on /admin/amazon does. Body optional:
 * { stores?: ('in'|'us')[] } limits which stores refresh; { asins?: string[] }
 * refreshes only those ASINs.
 *
 * Refreshing is idempotent and bounded: stale caches are rewritten via the
 * Creators API GetItems batching (≤10 ASINs/call) and each run is capped so a
 * single invocation stays well under a minute.
 */
const MAX_ASINS_PER_RUN = 300;

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = (process.env.CRON_SECRET || '').trim();
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('x-api-key') || '';
  const url = new URL(req.url);
  if (secret && (headerSecret === secret || url.searchParams.get('secret') === secret)) return true;
  const user = await getAuthUser();
  return !!user;
}

export async function POST(req: NextRequest) {
  return runRefresh(req);
}

// Some cron providers only issue GETs — accept them when authorized.
export async function GET(req: NextRequest) {
  return runRefresh(req);
}

interface StoreSummary { refreshed: number; live: number; fallback: number; asins: string[]; at?: string; }

async function refreshStore(store: Store, requestedAsins: string[]): Promise<StoreSummary> {
  let asins = requestedAsins;
  if (asins.length === 0) {
    const db = getDb();
    const products = db.prepare(
      `SELECT india_affiliate_url, us_affiliate_url, global_affiliate_url, affiliate_url FROM products
       WHERE status = 'published' AND deleted_at IS NULL`
    ).all() as any[];
    asins = store === 'us'
      ? [...new Set(products.map(productUsAsin).filter(Boolean) as string[])]
      : [...new Set(products.map(productIndiaAsin).filter(Boolean) as string[])];
  }

  asins = asins.slice(0, MAX_ASINS_PER_RUN);
  if (asins.length === 0) return { refreshed: 0, live: 0, fallback: 0, asins: [] };

  const liveMap = await getLivePrices(asins, store, { force: true });

  let live = 0;
  let fallback = 0;
  for (const [, lp] of liveMap) {
    if (lp.price != null && lp.price > 0 && lp.available) live++;
    else fallback++;
  }

  return { refreshed: asins.length, live, fallback, asins };
}

async function runRefresh(req: NextRequest) {
  ensureDbReady();
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedStores = Array.isArray(body?.stores) ? body.stores : [];
    const requested = Array.isArray(body?.asins) ? (body.asins as string[]) : [];

    // Only refresh stores that are actually configured; default = all of them.
    const stores = (requestedStores.length
      ? requestedStores.filter((s: any) => s === 'in' || s === 'us')
      : configuredStores()) as Store[];

    if (stores.length === 0) {
      return NextResponse.json({
        stores: {},
        diagnostics: getAllDiagnostics(),
        message: 'No Creators API credentials configured — nothing to refresh. Enter keys in Admin → Amazon API first.',
      });
    }

    const perStore: Record<string, any> = {};
    for (const store of stores) {
      const summary = await refreshStore(store, requested);
      summary.at = new Date().toISOString();
      recordCronRun(summary, store);
      perStore[store] = summary;
    }

    const totalLive = Object.values(perStore).reduce((n: number, s: any) => n + (s.live || 0), 0);
    return NextResponse.json({
      stores: perStore,
      diagnostics: getAllDiagnostics(),
      message: totalLive > 0
        ? `OK — ${totalLive} products have live Amazon prices across ${stores.length} store(s).`
        : `Refreshed — none returned a live price (check credentials / ASINs per store).`,
    });
  } catch (e: any) {
    console.error('Cron refresh error:', e);
    return NextResponse.json({ error: 'Refresh failed: ' + (e?.message || e) }, { status: 500 });
  }
}
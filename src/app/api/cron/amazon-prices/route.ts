import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getLivePrices } from '@/lib/amazon-price';
import { productIndiaAsin } from '@/lib/amazon-price';
import { recordCronRun, getDiagnostics } from '@/lib/creators-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Hourly Amazon.in price refresh. Trigger it from an external cron service
 * (cron-job.org, UptimeRobot, server cron) with:
 *
 *   POST https://alayainsider.com/api/cron/amazon-prices
 *   Header: x-cron-secret: <CRON_SECRET from .env>
 *
 * Admin users may also call it directly (session/bearer auth) — that is what
 * the "Refresh all now" button on /admin/amazon does. Body optional:
 * { asins?: string[] } refreshes only those ASINs.
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

async function runRefresh(req: NextRequest) {
  ensureDbReady();
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.asins) ? (body.asins as string[]) : [];

    let asins = requested;
    if (asins.length === 0) {
      const db = getDb();
      const products = db.prepare(
        `SELECT india_affiliate_url, affiliate_url FROM products
         WHERE status = 'published' AND deleted_at IS NULL`
      ).all() as any[];
      asins = [...new Set(products.map(productIndiaAsin).filter(Boolean) as string[])];
    }

    asins = asins.slice(0, MAX_ASINS_PER_RUN);
    if (asins.length === 0) {
      const summary = { refreshed: 0, live: 0, fallback: 0, asins: 0, at: new Date().toISOString() };
      recordCronRun(summary);
      return NextResponse.json({ ...summary, message: 'No amazon.in ASINs found on published products.' });
    }

    const liveMap = await getLivePrices(asins, { force: true });

    let live = 0;
    let fallback = 0;
    for (const [asin, lp] of liveMap) {
      if (lp.price != null && lp.price > 0 && lp.available) live++;
      else fallback++;
    }

    const summary = {
      refreshed: asins.length,
      live,
      fallback,
      asins,
      at: new Date().toISOString(),
    };
    recordCronRun(summary);

    return NextResponse.json({
      ...summary,
      diagnostics: getDiagnostics(),
      message: live > 0
        ? `OK — ${live} of ${asins.length} products have live Amazon.in prices.`
        : `Refreshed ${asins.length} ASINs — none returned a live price (check credentials / ASINs).`,
    });
  } catch (e: any) {
    console.error('Cron refresh error:', e);
    return NextResponse.json({ error: 'Refresh failed: ' + (e?.message || e) }, { status: 500 });
  }
}

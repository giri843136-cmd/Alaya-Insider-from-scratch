import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { refreshGeoLite2 } from '@/lib/geolite2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Monthly GeoLite2-Country refresh (keeps IP-based visitor routing current —
 * MaxMind publishes weekly, so monthly is plenty). Trigger it from the same
 * external cron service as the price refresh:
 *
 *   POST https://alayainsider.com/api/cron/geolite2
 *   Header: x-cron-secret: <CRON_SECRET from .env>
 *
 * Requires MAXMIND_LICENSE_KEY in .env (free MaxMind account → Manage License
 * Keys). Behavior is failure-safe:
 *   - no license key configured → 200 { skipped: true, reason }
 *   - download/HTTP error, bad archive, or failed magic check → the previous
 *     .mmdb is left untouched (atomic swap via temp file + rename)
 *   - success → 200 with the new file size and MaxMind build date
 *
 * Note: the running process keeps the DB it mapped at boot; the swap updates
 * the file on disk so the next restart/redeploy serves the new DB.
 */

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = (process.env.CRON_SECRET || '').trim();
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('x-api-key') || '';
  const url = new URL(req.url);
  if (secret && (headerSecret === secret || url.searchParams.get('secret') === secret)) return true;
  const user = await getAuthUser();
  return !!user;
}

async function run(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await refreshGeoLite2();

  // No key configured is a configuration no-op, not an error — 200 so the
  // monthly cron doesn't alarm, with an explicit reason in the body.
  if (result.skipped) {
    return NextResponse.json({ skipped: true, reason: result.reason });
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason, target: result.target }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    target: result.target,
    bytes: result.bytes,
    archiveDate: result.archiveDate,
    note: 'New DB is on disk; the running process serves it after the next restart/redeploy.',
  });
}

export async function POST(req: NextRequest) {
  return run(req);
}

// Some cron providers only issue GETs — accept them when authorized.
export async function GET(req: NextRequest) {
  return run(req);
}

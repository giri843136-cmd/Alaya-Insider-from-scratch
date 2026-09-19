import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import { runSnapshotUnderPolicy } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

/**
 * TASK 31b — cron-triggered snapshot (hPanel cron hits this URL; it cannot
 * run shell scripts).
 *
 * Auth: HEADER-ONLY secret — `x-cron-secret: $CRON_SECRET` (alias
 * `x-api-key`). Query-string secrets land in access logs, so this route
 * deliberately does NOT accept ?secret= (the newer of the two cron routes;
 * /api/cron/amazon-prices keeps its legacy aliases).
 *
 * Schedule (owner-side, hPanel cron): hourly URL hit with the header.
 * The route refuses loudly (409) until SNAPSHOT_DIR is set to a writable
 * path OUTSIDE the app root — ASK_ME recorded in TASK-QUEUE.md.
 */
export async function POST(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const headerSecret =
    req.headers.get('x-cron-secret') || req.headers.get('x-api-key') || '';
  if (!secret || !headerSecret || headerSecret.trim() !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  ensureDbReady();
  const result = await runSnapshotUnderPolicy(
    {
      SNAPSHOT_DIR: process.env.SNAPSHOT_DIR,
      SNAPSHOT_KEEP: process.env.SNAPSHOT_KEEP,
      DATABASE_PATH: process.env.DATABASE_PATH,
    },
    process.cwd(),
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: result.reason ? 409 : 500 });
  }
  return NextResponse.json(result, { status: 201 });
}

export async function GET(req: NextRequest) {
  // Convenience for hPanel cron UIs that only do GET — same auth, same work.
  return POST(req);
}

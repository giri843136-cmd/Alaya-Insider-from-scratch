import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import { getAuthUser } from '@/lib/auth';
import { listSnapshots } from '@/lib/snapshot-policy';
import { runSnapshotUnderPolicy } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

/**
 * TASK 31b — snapshot STATUS + manual trigger for the admin.
 *
 * GET /api/admin/snapshots
 *   Reports whether snapshots are configured (environment variable NAMES
 *   only — never values) and, when SNAPSHOT_DIR is set and acceptable,
 *   lists existing snapshot files with size (bytes) and mtime (UTC ISO).
 *   File CONTENTS are never read or returned.
 *
 * POST /api/admin/snapshots
 *   Runs one snapshot in-process via the shared policy core (same module a
 *   cron call would use), so the owner can trigger and observe a first
 *   snapshot from the admin before any schedule is wired. Refuses loudly
 *   (409) when SNAPSHOT_DIR is unset or inside the app root.
 */

const NAME_RE = /^alaya-\d{8}T\d{6}Z\.db$/;

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ensureDbReady();

  // READ-TIME GUARD: the shared listSnapshots runs every entry through the
  // same path policy as the writer and flags anything under public/ (or the
  // app root) with exposed: true — a backup in a web-served path must be
  // LOUD in this response, never merely unlisted.
  const { check, snapshots } = listSnapshots(process.env.SNAPSHOT_DIR, process.cwd(), {
    nameRe: NAME_RE,
  });
  const exposedCount = snapshots.filter((s) => s.exposed).length;

  return NextResponse.json(
    {
      configured: check.ok,
      reason: check.code,
      message: check.message,
      envVarNames: ['SNAPSHOT_DIR', 'SNAPSHOT_KEEP'],
      keep: process.env.SNAPSHOT_KEEP || '7',
      exposedCount,
      exposed: exposedCount > 0,
      snapshots,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

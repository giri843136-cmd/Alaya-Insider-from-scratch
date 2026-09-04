import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureDbReady } from '@/lib/init';
import { getAuthUser } from '@/lib/auth';

function logFile(): string {
  const configured = process.env.CREATORS_LOG;
  if (configured) return path.resolve(configured);
  const dbPath = process.env.DATABASE_PATH || './data/alaya.db';
  const dir = path.dirname(path.resolve(process.cwd(), dbPath));
  return path.join(dir, 'logs', 'creators-api.log');
}

/**
 * GET /api/creators/logs?store=in|us|all&lines=50
 * Returns the last N lines of data/logs/creators-api.log (admin-only) with an
 * optional per-store filter. The log format is:
 *   [creators-api] <iso> [in|us] <message>
 */
export async function GET(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const store = (url.searchParams.get('store') || 'all').toLowerCase();
    const lines = Math.min(500, Math.max(1, parseInt(url.searchParams.get('lines') || '50', 10) || 50));

    const file = logFile();
    if (!fs.existsSync(file)) {
      return NextResponse.json({ lines: [], file, message: 'No log file yet.' });
    }
    const content = fs.readFileSync(file, 'utf8');
    const all = content.split('\n').filter(Boolean);
    const filtered = store === 'all'
      ? all
      : all.filter(l => new RegExp(`\\[${store}\\]`, 'i').test(l) || !/\[(in|us)\]/.test(l));
    return NextResponse.json({ lines: filtered.slice(-lines), file, total: filtered.length });
  } catch (e: any) {
    console.error('Logs read error:', e);
    return NextResponse.json({ error: 'Failed to read logs: ' + (e?.message || e) }, { status: 500 });
  }
}
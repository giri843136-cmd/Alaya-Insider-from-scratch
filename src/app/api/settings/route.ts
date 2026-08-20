import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  ensureDbReady();
  const db = getDb();
  const settings = db.prepare('SELECT * FROM site_settings').all() as any[];
  const obj: Record<string, string> = {};
  settings.forEach(s => obj[s.key] = s.value);
  return NextResponse.json({ settings: obj });
}

export async function PUT(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { settings } = await req.json();
  const db = getDb();

  const stmt = db.prepare(`INSERT INTO site_settings (key, value, group_name, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);

  for (const [key, value] of Object.entries(settings)) {
    stmt.run(key, value as string, 'general');
  }

  return NextResponse.json({ success: true });
}

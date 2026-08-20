import { NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  let dbStatus = 'healthy';
  try { db.prepare('SELECT 1').get(); } catch { dbStatus = 'error'; }

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  let storageUsed = 0;
  try {
    const files = fs.readdirSync(path.join(uploadsDir, 'images'));
    files.forEach(f => { try { storageUsed += fs.statSync(path.join(uploadsDir, 'images', f)).size; } catch {} });
  } catch {}

  const errorCount = (db.prepare("SELECT COUNT(*) as cnt FROM activity_logs WHERE action LIKE '%error%' AND created_at >= datetime('now','-7 days')").get() as any).cnt;

  return NextResponse.json({
    database: dbStatus,
    storage: { used: storageUsed, formatted: `${(storageUsed / 1024 / 1024).toFixed(2)} MB` },
    application: 'running',
    errorCount,
    uptime: process.uptime(),
  });
}

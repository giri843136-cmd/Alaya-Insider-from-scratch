import { NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const logs = getDb().prepare(`
    SELECT al.*, u.username, u.first_name, u.last_name
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT 100
  `).all();

  return NextResponse.json({ logs });
}

import { NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const subs = db.prepare('SELECT email, first_name, source, is_active, subscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC').all() as any[];

  const csv = ['Email,First Name,Source,Active,Subscribed At'];
  for (const s of subs) {
    csv.push(`${s.email},${s.first_name},${s.source},${s.is_active ? 'Yes' : 'No'},${s.subscribed_at}`);
  }

  return new NextResponse(csv.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=subscribers.csv',
    },
  });
}

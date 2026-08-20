import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const links = getDb().prepare(`
    SELECT al.*, p.name as product_name, p.slug as product_slug
    FROM affiliate_links al
    LEFT JOIN products p ON al.product_id = p.id
    ORDER BY al.created_at DESC
  `).all();

  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const db = getDb();
  const id = uuid();

  db.prepare(`INSERT INTO affiliate_links (id, product_id, slug, destination_url, marketplace, affiliate_network, tracking_id, utm_source, utm_medium, utm_campaign, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, data.product_id||null, data.slug, data.destination_url, data.marketplace||'', data.affiliate_network||'', data.tracking_id||'', data.utm_source||'', data.utm_medium||'', data.utm_campaign||'', data.is_active!==false?1:0);

  return NextResponse.json({ id }, { status: 201 });
}

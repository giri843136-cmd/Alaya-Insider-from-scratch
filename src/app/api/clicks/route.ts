import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function POST(req: NextRequest) {
  ensureDbReady();
  try {
    const { product_id, source_page, link_id, destination_type } = await req.json();
    const db = getDb();
    const ua = req.headers.get('user-agent') || '';
    const device = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';
    const dest = destination_type || 'global';

    db.prepare(`INSERT INTO affiliate_clicks (id, link_id, product_id, destination_type, source_page, device, user_agent, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(uuid(), link_id || null, product_id || null, dest, source_page || '', device, ua.substring(0, 200));

    if (product_id) {
      db.prepare('UPDATE products SET click_count = click_count + 1 WHERE id = ?').run(product_id);
      if (dest === 'india') {
        db.prepare('UPDATE products SET india_click_count = india_click_count + 1 WHERE id = ?').run(product_id);
      } else {
        db.prepare('UPDATE products SET global_click_count = global_click_count + 1 WHERE id = ?').run(product_id);
      }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Click tracking failed' }, { status: 500 });
  }
}

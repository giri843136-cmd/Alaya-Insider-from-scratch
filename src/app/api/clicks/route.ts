import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { resolveVisitorStore } from '@/lib/geo';

/**
 * Fire-and-forget click beacon. The product anchor itself stays a DIRECT
 * amazon.in / amazon.com URL (OneLink compatibility — no internal redirector),
 * and this endpoint records the click server-side. Country comes from the same
 * geo chain the page used (CF-IPCountry → MaxMind → default).
 */
export async function POST(req: NextRequest) {
  ensureDbReady();
  try {
    const { product_id, source_page, link_id, destination_type, store } = await req.json();
    const db = getDb();
    const ua = req.headers.get('user-agent') || '';
    const device = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';
    const dest = destination_type || 'global';
    const geo = resolveVisitorStore(req.headers);

    // Legacy affiliate_clicks table (kept for the existing analytics dashboard).
    db.prepare(`INSERT INTO affiliate_clicks (id, link_id, product_id, destination_type, source_page, device, user_agent, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(uuid(), link_id || null, product_id || null, dest, source_page || '', device, ua.substring(0, 200));

    // Dual-store click log (amazon_clicks) — store + country breakdown.
    db.prepare(`INSERT INTO amazon_clicks (id, product_id, store, country, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))`)
      .run(uuid(), product_id || null, store === 'us' ? 'us' : 'in', geo.country);

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

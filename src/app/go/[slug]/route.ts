import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const { slug } = await params;
  const destination = new URL(req.url).searchParams.get('destination') || 'global';
  const db = getDb();

  // Try product slug
  const product = db.prepare("SELECT * FROM products WHERE slug = ? AND deleted_at IS NULL").get(slug) as any;
  if (product) {
    const ua = req.headers.get('user-agent') || '';
    const device = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';
    const referer = req.headers.get('referer') || '';

    // Track click with destination type
    db.prepare(`INSERT INTO affiliate_clicks (id, product_id, destination_type, source_page, device, user_agent, referrer, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(uuid(), product.id, destination, referer, device, ua.substring(0, 200), referer);

    // Update counters
    db.prepare('UPDATE products SET click_count = click_count + 1 WHERE id = ?').run(product.id);
    if (destination === 'india') {
      db.prepare('UPDATE products SET india_click_count = india_click_count + 1 WHERE id = ?').run(product.id);
    } else {
      db.prepare('UPDATE products SET global_click_count = global_click_count + 1 WHERE id = ?').run(product.id);
    }

    // Determine redirect URL
    let redirectUrl = '';
    if (destination === 'india' && product.india_affiliate_url) {
      redirectUrl = product.india_affiliate_url;
    } else if (product.global_affiliate_url) {
      redirectUrl = product.global_affiliate_url;
    } else if (product.affiliate_url) {
      redirectUrl = product.affiliate_url;
    }

    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, 302);
    }
  }

  // Try affiliate_links table
  const link = db.prepare('SELECT * FROM affiliate_links WHERE slug = ? AND is_active = 1').get(slug) as any;
  if (link) {
    const ua = req.headers.get('user-agent') || '';
    const device = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';
    db.prepare(`INSERT INTO affiliate_clicks (id, link_id, product_id, destination_type, source_page, device, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(uuid(), link.id, link.product_id, link.destination_type || destination, req.headers.get('referer') || '', device);
    db.prepare('UPDATE affiliate_links SET click_count = click_count + 1 WHERE id = ?').run(link.id);

    let dest = link.destination_url;
    const utms: string[] = [];
    if (link.utm_source) utms.push(`utm_source=${encodeURIComponent(link.utm_source)}`);
    if (link.utm_medium) utms.push(`utm_medium=${encodeURIComponent(link.utm_medium)}`);
    if (link.utm_campaign) utms.push(`utm_campaign=${encodeURIComponent(link.utm_campaign)}`);
    if (utms.length) dest += (dest.includes('?') ? '&' : '?') + utms.join('&');
    return NextResponse.redirect(dest, 302);
  }

  return NextResponse.redirect(new URL('/', req.url));
}

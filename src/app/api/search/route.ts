import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { enrichProductsWithLivePrice } from '@/lib/amazon-price';

export async function GET(req: NextRequest) {
  ensureDbReady();
  const q = new URL(req.url).searchParams.get('q') || '';
  if (!q || q.length < 2) {
    return NextResponse.json({ products: [], articles: [], categories: [] });
  }

  const db = getDb();
  const s = `%${q}%`;

  const rawProducts = db.prepare(`
    SELECT p.id, p.name, p.slug, p.current_price, p.primary_image, p.rating,
           p.global_affiliate_url, p.india_affiliate_url, p.affiliate_url, p.sku,
           b.name as brand_name
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE (p.name LIKE ? OR b.name LIKE ? OR p.tags LIKE ? OR p.short_description LIKE ?)
      AND p.status = 'published' AND p.deleted_at IS NULL
    LIMIT 8
  `).all(s, s, s, s);

  // Enrich with live Amazon.in prices (batched, cached 1 hour, graceful fallback)
  const products = await enrichProductsWithLivePrice(rawProducts as any[]);

  const articles = db.prepare(`
    SELECT id, title, slug, excerpt, featured_image
    FROM articles
    WHERE (title LIKE ? OR content LIKE ? OR excerpt LIKE ?)
      AND status = 'published' AND deleted_at IS NULL
    LIMIT 5
  `).all(s, s, s);

  const categories = db.prepare(`
    SELECT id, name, slug FROM categories WHERE name LIKE ? LIMIT 5
  `).all(s);

  // Log search
  db.prepare('INSERT INTO search_logs (id, query, results_count) VALUES (?, ?, ?)')
    .run(uuid(), q, products.length + articles.length + categories.length);

  return NextResponse.json({ products, articles, categories });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { enrichProductsWithLivePrice } from '@/lib/amazon-price';
import { resolveVisitorStore } from '@/lib/geo';
import { publicProducts } from '@/lib/public-product';

export async function GET(req: NextRequest) {
  ensureDbReady();
  const q = new URL(req.url).searchParams.get('q') || '';
  if (!q || q.length < 2) {
    return NextResponse.json({ products: [], articles: [], categories: [] });
  }

  const db = getDb();
  const s = `%${q}%`;

  const rawProducts = db.prepare(`
    SELECT p.id, p.name, p.slug, p.primary_image, p.image_alt, p.short_description,
           p.seo_title, p.seo_description, p.cta_text, p.published_at, p.is_featured,
           p.is_trending, p.is_editors_pick,
           p.global_affiliate_url, p.india_affiliate_url, p.us_affiliate_url, p.affiliate_url,
           b.name as brand_name
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE (p.name LIKE ? OR b.name LIKE ? OR p.tags LIKE ? OR p.short_description LIKE ?)
      AND p.status = 'published' AND p.deleted_at IS NULL
    LIMIT 8
  `).all(s, s, s, s);

  // Geo-aware enrichment: India → .in/₹, US → .com/$ (fallback .in), others → .in + OneLink.
  const geo = resolveVisitorStore(req.headers);
  const enriched = await enrichProductsWithLivePrice(rawProducts as any[], geo.store);
  // Public allow-list: search responses expose the same shape as /api/products.
  const products = publicProducts(enriched);

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

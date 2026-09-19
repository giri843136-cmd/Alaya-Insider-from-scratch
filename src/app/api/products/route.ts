import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { publicProducts } from '@/lib/public-product';

/**
 * WAVE 0.5 (2026-09-19): the public write path is DELETED, not gated.
 *
 * This route used to carry an authenticated POST that created products.
 * Product add/edit belongs exclusively to the double-gated admin route
 * (middleware 401 + in-handler getAuthUser on /api/admin/products), which is
 * what src/components/admin/ProductEditor.tsx already calls. Keeping a second
 * write route behind a single auth check here meant one stolen session cookie
 * allowed writes without the admin middleware layer, and every unauthenticated
 * write attempt reached the handler before its 401. There is no caller left:
 * admin writes go to /api/admin/products, CSV import to /api/products/import.
 * Mutating methods on this URL answer 401 (never a handler run), see the
 * [id] route for PUT/PATCH/DELETE stubs.
 */

export async function GET(req: NextRequest) {
  ensureDbReady();
  const db = getDb();
  const url = new URL(req.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'));
  const offset = (page - 1) * limit;
  const search = url.searchParams.get('search') || '';
  const category = url.searchParams.get('category') || '';
  const brand = url.searchParams.get('brand') || '';
  const sort = url.searchParams.get('sort') || 'newest';
  const featured = url.searchParams.get('featured');
  const trending = url.searchParams.get('trending');
  const editors_pick = url.searchParams.get('editors_pick');
  const minPrice = url.searchParams.get('min_price');
  const maxPrice = url.searchParams.get('max_price');
  const minRating = url.searchParams.get('min_rating');

  let where = ["p.status = 'published'", 'p.deleted_at IS NULL'];
  const params: any[] = [];

  // This endpoint is public read-only: always published rows, never drafts or
  // soft-deleted ones. There is no ?status= or ?admin=true escape hatch — the
  // admin UI reads full rows from the authenticated /api/admin/products.

  if (search) {
    where.push('(p.name LIKE ? OR p.short_description LIKE ? OR b.name LIKE ? OR p.tags LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (category) {
    where.push('(c.slug = ? OR c.parent_id = (SELECT id FROM categories WHERE slug = ?))');
    params.push(category, category);
  }

  if (brand) {
    where.push('b.slug = ?');
    params.push(brand);
  }

  if (featured === 'true') {
    where.push('p.is_featured = 1');
  }

  if (trending === 'true') {
    where.push('p.is_trending = 1');
  }

  if (editors_pick === 'true') {
    where.push('p.is_editors_pick = 1');
  }

  if (minPrice) {
    where.push('p.current_price >= ?');
    params.push(parseFloat(minPrice));
  }

  if (maxPrice) {
    where.push('p.current_price <= ?');
    params.push(parseFloat(maxPrice));
  }

  if (minRating) {
    where.push('p.rating >= ?');
    params.push(parseFloat(minRating));
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let orderBy = 'ORDER BY p.created_at DESC';
  switch (sort) {
    case 'price_asc': orderBy = 'ORDER BY p.current_price ASC'; break;
    case 'price_desc': orderBy = 'ORDER BY p.current_price DESC'; break;
    case 'rating': orderBy = 'ORDER BY p.rating DESC'; break;
    case 'popular': orderBy = 'ORDER BY p.click_count DESC'; break;
    case 'featured': orderBy = 'ORDER BY p.is_featured DESC, p.created_at DESC'; break;
    case 'name_asc': orderBy = 'ORDER BY p.name ASC'; break;
    case 'oldest': orderBy = 'ORDER BY p.created_at ASC'; break;
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
  `).get(...params) as any;

  const products = db.prepare(`
    SELECT p.*, b.name as brand_name, b.slug as brand_slug,
           c.name as category_name, c.slug as category_slug,
           sc.name as subcategory_name, sc.slug as subcategory_slug
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories sc ON p.subcategory_id = sc.id
    ${whereClause}
    ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const parsed = products.map((p: any) => ({
    ...p,
    benefits: JSON.parse(p.benefits || '[]'),
    pros: JSON.parse(p.pros || '[]'),
    cons: JSON.parse(p.cons || '[]'),
    gallery_images: JSON.parse(p.gallery_images || '[]'),
    tags: JSON.parse(p.tags || '[]'),
    specifications: JSON.parse(p.specifications || '{}'),
    additional_retailers: JSON.parse(p.additional_retailers || '[]'),
  }));

  // Public allow-list: strip everything not on the allow-list (prices, rating,
  // live_*, counters, tracking ids, affiliate_network, …) before responding.
  // Full rows are only available from the authenticated /api/admin/products.
  return NextResponse.json({
    products: publicProducts(parsed),
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
}

/**
 * WAVE 0.5: every mutating method on the public collection route answers a
 * uniform 401 with no handler logic and no DB access — writes belong to the
 * double-gated /api/admin/products. A missing export would 405; these stubs
 * make the closure explicit and uniform.
 */
async function writeNotAllowed(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(): Promise<NextResponse> {
  return writeNotAllowed();
}

export async function PUT(): Promise<NextResponse> {
  return writeNotAllowed();
}

export async function PATCH(): Promise<NextResponse> {
  return writeNotAllowed();
}

export async function DELETE(): Promise<NextResponse> {
  return writeNotAllowed();
}


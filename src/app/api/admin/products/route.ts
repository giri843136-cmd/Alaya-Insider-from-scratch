import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/**
 * Authenticated product reads for the admin UI (full rows).
 *
 * Reuses the existing session mechanism (JWT auth_token cookie via
 * getAuthUser) — no new auth system. The public /api/products keeps serving
 * the allow-listed public shape; everything here requires a valid session and
 * returns the complete product row, including draft/archived/soft-deleted rows
 * and the status filter the public endpoint no longer exposes.
 */
export async function GET(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const url = new URL(req.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'));
  const offset = (page - 1) * limit;
  const search = url.searchParams.get('search') || '';
  const category = url.searchParams.get('category') || '';
  const brand = url.searchParams.get('brand') || '';
  const status = url.searchParams.get('status') || '';
  const sort = url.searchParams.get('sort') || 'newest';
  const featured = url.searchParams.get('featured');
  const trending = url.searchParams.get('trending');
  const editors_pick = url.searchParams.get('editors_pick');

  let where = ['p.deleted_at IS NULL'];
  const params: any[] = [];

  // Admin sees every status; ?status= filters when provided (kept for the
  // admin status dropdown — it never existed publicly).
  if (status) {
    where.push('p.status = ?');
    params.push(status);
  }

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

  const whereClause = `WHERE ${where.join(' AND ')}`;

  let orderBy = 'ORDER BY p.created_at DESC';
  switch (sort) {
    case 'name_asc': orderBy = 'ORDER BY p.name ASC'; break;
    case 'oldest': orderBy = 'ORDER BY p.created_at ASC'; break;
    case 'price_asc': orderBy = 'ORDER BY p.current_price ASC'; break;
    case 'price_desc': orderBy = 'ORDER BY p.current_price DESC'; break;
    case 'rating': orderBy = 'ORDER BY p.rating DESC'; break;
    case 'popular': orderBy = 'ORDER BY p.click_count DESC'; break;
    case 'featured': orderBy = 'ORDER BY p.is_featured DESC, p.created_at DESC'; break;
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

  // no-store: authenticated data must never be cached by a reverse proxy.
  const res = NextResponse.json({
    products: parsed,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.headers.set('Pragma', 'no-cache');
  return res;
}

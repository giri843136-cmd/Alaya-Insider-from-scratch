import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { publicProduct } from '@/lib/public-product';

/**
 * GET /api/products/[id] — dual shape.
 *  - Session holder: full product row + related products (admin editor needs
 *    every field to edit; this is exactly what it consumed before).
 *  - Unauthenticated: public allow-list projection only (see public-product.ts)
 *    plus id/slug/status/is_featured/is_trending/is_editors_pick/brand_slug/
 *    category_slug/subcategory_slug for navigation and card badges, and a
 *    related-products strip. Never prices, rating, review_count, live_*, 
 *    specifications, sku, counters, tracking ids or affiliate_network.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();

  const product = db.prepare(`
    SELECT p.*, b.name as brand_name, b.slug as brand_slug,
           c.name as category_name, c.slug as category_slug,
           sc.name as subcategory_name, sc.slug as subcategory_slug
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories sc ON p.subcategory_id = sc.id
    WHERE (p.id = ? OR p.slug = ?) AND p.deleted_at IS NULL
  `).get(id, id) as any;

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const user = await getAuthUser();

  const related = db.prepare(`
    SELECT p.id, p.name, p.slug, p.current_price, p.previous_price, p.rating, p.review_count,
           p.primary_image, p.image_alt, p.short_description, b.name as brand_name, b.slug as brand_slug
    FROM products p LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.category_id = ? AND p.id != ? AND p.status = 'published' AND p.deleted_at IS NULL LIMIT 4
  `).all(product.category_id, product.id);

  const parseProduct = (p: any) => ({
    ...p,
    benefits: JSON.parse(p.benefits || '[]'),
    pros: JSON.parse(p.pros || '[]'),
    cons: JSON.parse(p.cons || '[]'),
    gallery_images: JSON.parse(p.gallery_images || '[]'),
    tags: JSON.parse(p.tags || '[]'),
    specifications: JSON.parse(p.specifications || '{}'),
    additional_retailers: JSON.parse(p.additional_retailers || '[]'),
  });

  const parsed = parseProduct(product);
  const parsedRelated = related.map(parseProduct);

  if (user) {
    // Authenticated: full row + related, as the admin editor expects.
    const res = NextResponse.json({ product: parsed, related: parsedRelated });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.headers.set('Pragma', 'no-cache');
    return res;
  }

  // Unauthenticated: allow-list only. Drafts must not be served publicly even
  // if the caller knows the slug, so non-published rows 404 here.
  if (product.status !== 'published') {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const relatedPublic = parsedRelated.map((r) => publicProduct(r, ['id', 'is_featured', 'is_trending', 'is_editors_pick']));

  return NextResponse.json({
    product: publicProduct(parsed, [
      'id',
      'status',
      'is_featured',
      'is_trending',
      'is_editors_pick',
      'brand_slug',
      'category_slug',
      'subcategory_slug',
    ]),
    related: relatedPublic,
  });
}

/**
 * WAVE 0.5 (2026-09-19): the public write path is DELETED, not gated.
 *
 * This route used to carry session-gated PUT (update) and DELETE (soft-delete).
 * Product writes belong exclusively to the double-gated admin route
 * /api/admin/products (+ /api/admin/products/[id]) — middleware 401 AND
 * in-handler getAuthUser — which is what ProductEditor.tsx calls. Keeping a
 * second, single-gated write route under the public URL meant one stolen
 * session cookie could write without the admin middleware layer, and every
 * unauthenticated write reached the handler before its 401 (PATCH even
 * answered a bare 405). Every mutating method now answers a uniform 401 with
 * no handler logic and no DB access, session or no session.
 */
async function writeNotAllowed(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function PUT(): Promise<NextResponse> {
  return writeNotAllowed();
}

export async function PATCH(): Promise<NextResponse> {
  return writeNotAllowed();
}

export async function POST(): Promise<NextResponse> {
  return writeNotAllowed();
}

export async function DELETE(): Promise<NextResponse> {
  return writeNotAllowed();
}

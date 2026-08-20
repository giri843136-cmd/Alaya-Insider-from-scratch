import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();

  // Try by id first, then by slug
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

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Get related products (same category)
  const related = db.prepare(`
    SELECT p.id, p.name, p.slug, p.current_price, p.previous_price, p.rating, p.review_count,
           p.primary_image, p.image_alt, p.short_description, b.name as brand_name, b.slug as brand_slug
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.category_id = ? AND p.id != ? AND p.status = 'published' AND p.deleted_at IS NULL
    LIMIT 4
  `).all(product.category_id, product.id);

  return NextResponse.json({
    product: {
      ...product,
      benefits: JSON.parse(product.benefits || '[]'),
      pros: JSON.parse(product.pros || '[]'),
      cons: JSON.parse(product.cons || '[]'),
      gallery_images: JSON.parse(product.gallery_images || '[]'),
      tags: JSON.parse(product.tags || '[]'),
      specifications: JSON.parse(product.specifications || '{}'),
      additional_retailers: JSON.parse(product.additional_retailers || '[]'),
    },
    related: related.map((r: any) => ({ ...r })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const data = await req.json();
  const db = getDb();

  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(id) as any;
  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const slug = data.slug || existing.slug;

  // Check slug uniqueness if changed
  if (slug !== existing.slug) {
    const slugExists = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(slug, id);
    if (slugExists) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 400 });
    }
  }

  db.prepare(`
    UPDATE products SET
      name = ?, slug = ?, brand_id = ?, category_id = ?, subcategory_id = ?, sku = ?,
      current_price = ?, previous_price = ?, currency = ?, rating = ?, review_count = ?,
      primary_image = ?, gallery_images = ?, thumbnail = ?, image_alt = ?,
      short_description = ?, full_description = ?, why_we_recommend = ?, best_for = ?,
      benefits = ?, pros = ?, cons = ?, buying_advice = ?, specifications = ?, tags = ?,
      status = ?, is_featured = ?, is_trending = ?, is_editors_pick = ?,
      affiliate_url = ?, marketplace = ?, affiliate_network = ?, tracking_id = ?, cta_text = ?,
      additional_retailers = ?, seo_title = ?, seo_description = ?, canonical_url = ?, focus_keyword = ?,
      updated_by = ?, updated_at = datetime('now'),
      published_at = CASE WHEN ? = 'published' AND published_at IS NULL THEN datetime('now') ELSE published_at END,
      archived_at = CASE WHEN ? = 'archived' THEN datetime('now') ELSE archived_at END
    WHERE id = ?
  `).run(
    data.name ?? existing.name, slug,
    data.brand_id ?? existing.brand_id, data.category_id ?? existing.category_id,
    data.subcategory_id ?? existing.subcategory_id, data.sku ?? existing.sku,
    data.current_price ?? existing.current_price, data.previous_price ?? existing.previous_price,
    data.currency ?? existing.currency, data.rating ?? existing.rating,
    data.review_count ?? existing.review_count,
    data.primary_image ?? existing.primary_image,
    JSON.stringify(data.gallery_images ?? JSON.parse(existing.gallery_images || '[]')),
    data.thumbnail ?? existing.thumbnail, data.image_alt ?? existing.image_alt,
    data.short_description ?? existing.short_description,
    data.full_description ?? existing.full_description,
    data.why_we_recommend ?? existing.why_we_recommend,
    data.best_for ?? existing.best_for,
    JSON.stringify(data.benefits ?? JSON.parse(existing.benefits || '[]')),
    JSON.stringify(data.pros ?? JSON.parse(existing.pros || '[]')),
    JSON.stringify(data.cons ?? JSON.parse(existing.cons || '[]')),
    data.buying_advice ?? existing.buying_advice,
    JSON.stringify(data.specifications ?? JSON.parse(existing.specifications || '{}')),
    JSON.stringify(data.tags ?? JSON.parse(existing.tags || '[]')),
    data.status ?? existing.status,
    data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : existing.is_featured,
    data.is_trending !== undefined ? (data.is_trending ? 1 : 0) : existing.is_trending,
    data.is_editors_pick !== undefined ? (data.is_editors_pick ? 1 : 0) : existing.is_editors_pick,
    data.affiliate_url ?? existing.affiliate_url,
    data.marketplace ?? existing.marketplace,
    data.affiliate_network ?? existing.affiliate_network,
    data.tracking_id ?? existing.tracking_id,
    data.cta_text ?? existing.cta_text,
    JSON.stringify(data.additional_retailers ?? JSON.parse(existing.additional_retailers || '[]')),
    data.seo_title ?? existing.seo_title,
    data.seo_description ?? existing.seo_description,
    data.canonical_url ?? existing.canonical_url,
    data.focus_keyword ?? existing.focus_keyword,
    user.id, data.status ?? existing.status, data.status ?? existing.status, id
  );

  // Update affiliate link
  if (data.affiliate_url) {
    const existingLink = db.prepare('SELECT id FROM affiliate_links WHERE product_id = ?').get(id) as any;
    if (existingLink) {
      db.prepare('UPDATE affiliate_links SET destination_url = ?, marketplace = ?, affiliate_network = ?, updated_at = datetime("now") WHERE id = ?')
        .run(data.affiliate_url, data.marketplace || '', data.affiliate_network || '', existingLink.id);
    } else {
      db.prepare('INSERT INTO affiliate_links (id, product_id, slug, destination_url, marketplace, affiliate_network, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(uuid(), id, slug, data.affiliate_url, data.marketplace || '', data.affiliate_network || '');
    }
  }

  db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), user.id, 'updated', 'product', id, `Product "${data.name || existing.name}" updated`);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(id) as any;
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // Soft delete
  db.prepare('UPDATE products SET deleted_at = datetime("now"), status = "archived" WHERE id = ?').run(id);

  db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), user.id, 'deleted', 'product', id, `Product "${product.name}" archived`);

  return NextResponse.json({ success: true });
}

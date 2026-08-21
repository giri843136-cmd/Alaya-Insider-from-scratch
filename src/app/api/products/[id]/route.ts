import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

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

  const related = db.prepare(`
    SELECT p.id, p.name, p.slug, p.current_price, p.previous_price, p.rating, p.review_count,
           p.primary_image, p.image_alt, p.short_description, b.name as brand_name, b.slug as brand_slug
    FROM products p LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.category_id = ? AND p.id != ? AND p.status = 'published' AND p.deleted_at IS NULL LIMIT 4
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
    related,
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
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const slug = data.slug || existing.slug;
  if (slug !== existing.slug) {
    const slugExists = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(slug, id);
    if (slugExists) return NextResponse.json({ error: 'Slug already in use' }, { status: 400 });
  }

  // Build update dynamically to handle ALL fields including destinations
  const fields: Record<string, any> = {
    name: data.name ?? existing.name,
    slug,
    brand_id: data.brand_id ?? existing.brand_id,
    category_id: data.category_id ?? existing.category_id,
    subcategory_id: data.subcategory_id ?? existing.subcategory_id,
    sku: data.sku ?? existing.sku,
    current_price: data.current_price ?? existing.current_price,
    previous_price: data.previous_price ?? existing.previous_price,
    currency: data.currency ?? existing.currency,
    rating: data.rating ?? existing.rating,
    review_count: data.review_count ?? existing.review_count,
    primary_image: data.primary_image ?? existing.primary_image,
    gallery_images: JSON.stringify(data.gallery_images ?? JSON.parse(existing.gallery_images || '[]')),
    thumbnail: data.thumbnail ?? existing.thumbnail,
    image_alt: data.image_alt ?? existing.image_alt,
    short_description: data.short_description ?? existing.short_description,
    full_description: data.full_description ?? existing.full_description,
    why_we_recommend: data.why_we_recommend ?? existing.why_we_recommend,
    best_for: data.best_for ?? existing.best_for,
    benefits: JSON.stringify(data.benefits ?? JSON.parse(existing.benefits || '[]')),
    pros: JSON.stringify(data.pros ?? JSON.parse(existing.pros || '[]')),
    cons: JSON.stringify(data.cons ?? JSON.parse(existing.cons || '[]')),
    buying_advice: data.buying_advice ?? existing.buying_advice,
    specifications: JSON.stringify(data.specifications ?? JSON.parse(existing.specifications || '{}')),
    tags: JSON.stringify(data.tags ?? JSON.parse(existing.tags || '[]')),
    status: data.status ?? existing.status,
    is_featured: data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : existing.is_featured,
    is_trending: data.is_trending !== undefined ? (data.is_trending ? 1 : 0) : existing.is_trending,
    is_editors_pick: data.is_editors_pick !== undefined ? (data.is_editors_pick ? 1 : 0) : existing.is_editors_pick,
    // Legacy affiliate fields
    affiliate_url: data.affiliate_url ?? existing.affiliate_url,
    marketplace: data.marketplace ?? existing.marketplace,
    affiliate_network: data.affiliate_network ?? existing.affiliate_network,
    tracking_id: data.tracking_id ?? existing.tracking_id,
    cta_text: data.cta_text ?? existing.cta_text,
    // DUAL DESTINATION FIELDS
    global_affiliate_url: data.global_affiliate_url ?? existing.global_affiliate_url,
    global_affiliate_network: data.global_affiliate_network ?? existing.global_affiliate_network,
    global_tracking_id: data.global_tracking_id ?? existing.global_tracking_id,
    global_cta_label: data.global_cta_label ?? existing.global_cta_label,
    global_active: data.global_active !== undefined ? (data.global_active ? 1 : 0) : existing.global_active,
    india_affiliate_url: data.india_affiliate_url ?? existing.india_affiliate_url,
    india_affiliate_network: data.india_affiliate_network ?? existing.india_affiliate_network,
    india_tracking_id: data.india_tracking_id ?? existing.india_tracking_id,
    india_cta_label: data.india_cta_label ?? existing.india_cta_label,
    india_active: data.india_active !== undefined ? (data.india_active ? 1 : 0) : existing.india_active,
    // Other
    additional_retailers: JSON.stringify(data.additional_retailers ?? JSON.parse(existing.additional_retailers || '[]')),
    seo_title: data.seo_title ?? existing.seo_title,
    seo_description: data.seo_description ?? existing.seo_description,
    canonical_url: data.canonical_url ?? existing.canonical_url,
    focus_keyword: data.focus_keyword ?? existing.focus_keyword,
    updated_by: user.id,
  };

  const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const status = fields.status;
  const sql = `UPDATE products SET ${setClauses},
    updated_at = datetime('now'),
    published_at = CASE WHEN '${status}' = 'published' AND published_at IS NULL THEN datetime('now') ELSE published_at END,
    archived_at = CASE WHEN '${status}' = 'archived' THEN datetime('now') ELSE archived_at END
    WHERE id = ?`;

  db.prepare(sql).run(...Object.values(fields), id);

  db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), user.id, 'updated', 'product', id, `Product "${fields.name}" updated`);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const product = db.prepare('SELECT name FROM products WHERE id = ? AND deleted_at IS NULL').get(id) as any;
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  db.prepare("UPDATE products SET deleted_at = datetime('now'), status = 'archived' WHERE id = ?").run(id);

  db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), user.id, 'deleted', 'product', id, `Product "${product.name}" archived`);

  return NextResponse.json({ success: true });
}

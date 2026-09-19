import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import {
  validateProductDraft,
  validateProductPublish,
  validateReferences,
} from '@/lib/product-write-validation';

/**
 * WAVE 0.5: authenticated product read/edit/archive for the admin editor.
 *
 * ProductEditor.tsx calls exactly these:
 *   GET    /api/admin/products/[id]   (editor load — full row)
 *   PUT    /api/admin/products/[id]   (save / publish / unpublish / archive)
 *   DELETE /api/admin/products/[id]   (archive from the products list)
 *
 * Until this file existed, all three answered Next.js's bare 405 and the admin
 * Add/Edit flow was broken in production. Defence in depth: the middleware
 * already 401s cookie-less callers on /api/admin/*; every handler here also
 * verifies the session itself.
 */

async function requireUser(): Promise<ReturnType<typeof getAuthUser>> {
  return getAuthUser();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  // Draft-safety: the editor parses JSON columns on load.
  const parse = (s: string | null) => {
    try { return JSON.parse(s || '[]'); } catch { return []; }
  };
  product.benefits = parse(product.benefits);
  product.pros = parse(product.pros);
  product.cons = parse(product.cons);
  product.gallery_images = parse(product.gallery_images);
  product.tags = parse(product.tags);
  try { product.specifications = JSON.parse(product.specifications || '{}'); } catch { product.specifications = {}; }
  product.additional_retailers = parse(product.additional_retailers);

  const res = NextResponse.json({ product, related: [] });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.headers.set('Pragma', 'no-cache');
  return res;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const data = await req.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // Draft-safety validation with per-field, human-readable messages.
    const draft = validateProductDraft(data);
    if (Object.keys(draft.field_errors).length > 0) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields', field_errors: draft.field_errors, errors: draft.errors },
        { status: 400 },
      );
    }
    const refErrors = validateReferences(db, data);
    if (Object.keys(refErrors).length > 0) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields', field_errors: refErrors, errors: Object.values(refErrors) },
        { status: 400 },
      );
    }

    // Slug change: uniqueness check with a human-readable message.
    const slug = data.slug || existing.slug;
    if (slug !== existing.slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return NextResponse.json(
          { error: 'Please fix the highlighted fields', field_errors: { slug: 'Slug may only contain lowercase letters, numbers and hyphens' }, errors: ['Slug may only contain lowercase letters, numbers and hyphens'] },
          { status: 400 },
        );
      }
      const slugExists = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(slug, id);
      if (slugExists) {
        return NextResponse.json(
          { error: 'Please fix the highlighted fields', field_errors: { slug: 'Another product already uses this URL slug — pick a different one' }, errors: ['Another product already uses this URL slug — pick a different one'] },
          { status: 400 },
        );
      }
    }

    // Server-side publish validation (identical messages to the editor modal).
    const newStatus = data.status ?? existing.status;
    if (newStatus === 'published' && existing.status !== 'published') {
      const blockers = validateProductPublish(data, existing);
      if (blockers.length > 0) {
        return NextResponse.json(
          { error: 'Cannot publish', errors: blockers, blockers },
          { status: 422 },
        );
      }
    }

    // Build update dynamically to handle ALL fields including destinations.
    const fields: Record<string, any> = {
      name: data.name ?? existing.name,
      slug,
      brand_id: data.brand_id || null,
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      sku: data.sku ?? existing.sku,
      // Commercial fields: absent in the payload keeps the stored value; an
      // explicit null CLEARS it. Never fabricated, never forced to 0.
      current_price: data.current_price !== undefined ? data.current_price : existing.current_price,
      previous_price: data.previous_price !== undefined ? data.previous_price : existing.previous_price,
      currency: data.currency !== undefined ? data.currency : existing.currency,
      rating: data.rating !== undefined ? data.rating : existing.rating,
      review_count: data.review_count !== undefined ? data.review_count : existing.review_count,
      primary_image: data.primary_image ?? existing.primary_image,
      gallery_images: JSON.stringify(data.gallery_images ?? JSON.parse(existing.gallery_images || '[]')),
      thumbnail: data.thumbnail ?? existing.thumbnail,
      image_alt: data.image_alt ?? existing.image_alt,
      short_description: data.short_description ?? existing.short_description,
      full_description: data.full_description ?? existing.full_description,
      why_we_recommend: data.why_we_recommend ?? existing.why_we_recommend,
      best_for: data.best_for ?? existing.best_for,
      benefits: data.benefits !== undefined ? (typeof data.benefits === 'string' ? data.benefits : JSON.stringify(data.benefits)) : existing.benefits,
      pros: data.pros !== undefined ? (typeof data.pros === 'string' ? data.pros : JSON.stringify(data.pros)) : existing.pros,
      cons: data.cons !== undefined ? (typeof data.cons === 'string' ? data.cons : JSON.stringify(data.cons)) : existing.cons,
      buying_advice: data.buying_advice ?? existing.buying_advice,
      specifications: data.specifications !== undefined ? (typeof data.specifications === 'string' ? data.specifications : JSON.stringify(data.specifications)) : existing.specifications,
      tags: data.tags !== undefined ? (typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags)) : existing.tags,
      status: newStatus,
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
      us_affiliate_url: data.us_affiliate_url ?? existing.us_affiliate_url ?? '',
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

    // Log status change specifically
    const action = newStatus !== existing.status
      ? (newStatus === 'published' ? 'published' : newStatus === 'archived' ? 'archived' : 'updated')
      : 'updated';
    const details = newStatus !== existing.status
      ? `Product "${fields.name}" ${action} (${existing.status} → ${newStatus})`
      : `Product "${fields.name}" updated`;
    db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), user.id, action, 'product', id, details);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Product update error:', e);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    const product = db.prepare('SELECT name FROM products WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    db.prepare("UPDATE products SET deleted_at = datetime('now'), status = 'archived' WHERE id = ?").run(id);

    db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), user.id, 'deleted', 'product', id, `Product "${product.name}" archived`);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Product delete error:', e);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

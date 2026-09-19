import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';
import {
  validateProductDraft,
  validateProductPublish,
  validateReferences,
} from '@/lib/product-write-validation';

/**
 * WAVE 0.5 (2026-09-19): authenticated product CREATE for the admin editor.
 *
 * ProductEditor.tsx has always POSTed here ("Save Draft" on /admin/products/new)
 * but this module only ever exported GET, so Add-Product answered a bare 405
 * in production. The create logic is ported from the public POST that
 * WAVE 0.5 deleted, with three changes:
 *   1. validation FIRST, with per-field human-readable messages (400),
 *   2. commercial fields are NULL-safe: absent means NULL — never ||0,
 *   3. it lives behind the double gate (middleware 401 + this getAuthUser).
 */
export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const db = getDb();

    // Draft-safety validation: per-field messages, nothing demands prices.
    // requireName: POST creates a row — the name must be present.
    const draft = validateProductDraft(data, { requireName: true });
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

    // Server-side publish validation for create-as-published (the editor's
    // Publish button on a NEW product POSTs with status=published). Same
    // blockers as the editor modal and the PUT path — no silent publishes.
    if (data.status === 'published') {
      const blockers = validateProductPublish(data, null);
      if (blockers.length > 0) {
        return NextResponse.json(
          { error: 'Cannot publish', errors: blockers, blockers },
          { status: 422 },
        );
      }
    }

    const name = String(data.name).trim();
    const id = uuid();
    const slug = data.slug || slugify(name, { lower: true, strict: true });
    if (!slug) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields', field_errors: { slug: 'Could not generate a valid URL slug from the product name — type one manually' }, errors: ['Could not generate a valid URL slug from the product name — type one manually'] },
        { status: 400 },
      );
    }

    // Slug uniqueness with a field-targeted message.
    const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (existing) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields', field_errors: { slug: 'Another product already uses this URL slug — pick a different one' }, errors: ['Another product already uses this URL slug — pick a different one'] },
        { status: 400 },
      );
    }

    const cols = [
      'id','name','slug','brand_id','category_id','subcategory_id','sku',
      'current_price','previous_price','currency','rating','review_count',
      'primary_image','gallery_images','thumbnail','image_alt',
      'short_description','full_description','why_we_recommend','best_for',
      'benefits','pros','cons','buying_advice','specifications','tags',
      'status','is_featured','is_trending','is_editors_pick',
      'affiliate_url','marketplace','affiliate_network','tracking_id','cta_text',
      'global_affiliate_url','global_affiliate_network','global_tracking_id','global_cta_label','global_active',
      'india_affiliate_url','india_affiliate_network','india_tracking_id','india_cta_label','india_active',
      'us_affiliate_url',
      'additional_retailers','seo_title','seo_description','canonical_url','focus_keyword',
      'created_by','published_at'
    ];
    const vals = [
      id, name, slug, data.brand_id||null, data.category_id||null, data.subcategory_id||null, data.sku||'',
      // WAVE 0.5 / TASK 4: commercial fields are absent-or-explicit only.
      // Absent (undefined/null/'') stores NULL — never a fabricated 0 price
      // or 0 rating. An explicit 0 the operator typed is stored as 0.
      data.current_price ?? null, data.previous_price ?? null, data.currency || 'USD', data.rating ?? null, data.review_count ?? null,
      data.primary_image||'', JSON.stringify(data.gallery_images||[]), data.thumbnail||'', data.image_alt||'',
      data.short_description||'', data.full_description||'', data.why_we_recommend||'', data.best_for||'',
      typeof data.benefits === 'string' ? data.benefits : JSON.stringify(data.benefits||[]),
      typeof data.pros === 'string' ? data.pros : JSON.stringify(data.pros||[]),
      typeof data.cons === 'string' ? data.cons : JSON.stringify(data.cons||[]),
      data.buying_advice||'',
      typeof data.specifications === 'string' ? data.specifications : JSON.stringify(data.specifications||{}),
      typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags||[]),
      data.status||'draft', data.is_featured?1:0, data.is_trending?1:0, data.is_editors_pick?1:0,
      data.affiliate_url||'', data.marketplace||'', data.affiliate_network||'', data.tracking_id||'', data.cta_text||'Check Price',
      data.global_affiliate_url||'', data.global_affiliate_network||'', data.global_tracking_id||'', data.global_cta_label||'Explore Global Options', data.global_active!==false?1:0,
      data.india_affiliate_url||'', data.india_affiliate_network||'', data.india_tracking_id||'', data.india_cta_label||'Explore India', data.india_active!==false?1:0,
      data.us_affiliate_url||'',
      JSON.stringify(data.additional_retailers||[]), data.seo_title||'', data.seo_description||'', data.canonical_url||'', data.focus_keyword||'',
      user.id, data.status === 'published' ? new Date().toISOString() : null,
    ];
    db.prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...vals);

    // Create affiliate link — use a unique slug to avoid UNIQUE constraint collisions
    if (data.affiliate_url) {
      try {
        db.prepare(`INSERT INTO affiliate_links (id, product_id, slug, destination_url, marketplace, affiliate_network, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
          .run(uuid(), id, `link-${slug}`, data.affiliate_url, data.marketplace || '', data.affiliate_network || '');
      } catch (linkErr: any) {
        console.error('Affiliate link creation failed:', linkErr.message);
      }
    }

    // Log
    db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), user.id, 'created', 'product', id, `Product "${name}" created`);

    const res = NextResponse.json({ id, slug }, { status: 201 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: any) {
    console.error('Product create error:', e);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

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

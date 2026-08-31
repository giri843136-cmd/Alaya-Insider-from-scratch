import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';
import { getLivePrice, extractAsin } from '@/lib/amazon-price';

export async function GET(req: NextRequest) {
  ensureDbReady();
  const db = getDb();
  const url = new URL(req.url);
  const isAdmin = url.searchParams.get('admin') === 'true';

  // Build response with no-cache headers for admin queries to prevent reverse proxy caching
  const jsonResponse = (data: any, status = 200) => {
    const res = NextResponse.json(data, { status });
    if (isAdmin) {
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.headers.set('Pragma', 'no-cache');
    }
    return res;
  };

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
  const minPrice = url.searchParams.get('min_price');
  const maxPrice = url.searchParams.get('max_price');
  const minRating = url.searchParams.get('min_rating');

  let where = ['p.deleted_at IS NULL'];
  const params: any[] = [];

  if (!isAdmin) {
    where.push("p.status = 'published'");
  } else if (status) {
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

  if (isAdmin) {
    console.log(`[PRODUCTS] Admin query: total=${countResult.total}, page=${page}, limit=${limit}`);
  }

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

  // Enrich products with live prices from Amazon API
  const enrichedProducts = await Promise.all(products.map(async (p: any) => {
    const asin = extractAsin(p.global_affiliate_url || p.affiliate_url || '') || p.sku;
    let livePrice: number | null = null;
    if (asin) {
      try {
        const priceData = await getLivePrice(asin);
        livePrice = priceData.price;
      } catch {}
    }
    return {
      ...p,
      live_price: livePrice,
      benefits: JSON.parse(p.benefits || '[]'),
      pros: JSON.parse(p.pros || '[]'),
      cons: JSON.parse(p.cons || '[]'),
      gallery_images: JSON.parse(p.gallery_images || '[]'),
      tags: JSON.parse(p.tags || '[]'),
      specifications: JSON.parse(p.specifications || '{}'),
      additional_retailers: JSON.parse(p.additional_retailers || '[]'),
    };
  }));

  return jsonResponse({
    products: enrichedProducts,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    const db = getDb();
    const id = uuid();
    const slug = data.slug || slugify(data.name.trim(), { lower: true, strict: true });
    if (!slug) {
      return NextResponse.json({ error: 'Could not generate a valid URL slug from the product name' }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (existing) {
      return NextResponse.json({ error: 'A product with this URL slug already exists' }, { status: 400 });
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
      'additional_retailers','seo_title','seo_description','canonical_url','focus_keyword',
      'created_by','published_at'
    ];
    const vals = [
      id, data.name, slug, data.brand_id||null, data.category_id||null, data.subcategory_id||null, data.sku||'',
      data.current_price||0, data.previous_price||null, data.currency||'USD', data.rating||0, data.review_count||0,
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
      .run(uuid(), user.id, 'created', 'product', id, `Product "${data.name}" created`);

    return NextResponse.json({ id, slug }, { status: 201 });
  } catch (e: any) {
    console.error('Product create error:', e);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

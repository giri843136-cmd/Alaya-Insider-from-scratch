import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';
import { parseImportCsv, amazonUrl, type ImportRow } from '@/lib/product-import';

interface RowOutcome {
  line: number;
  name: string;
  ok: boolean;
  error?: string;
  slug?: string;
  warnings?: string[];
}

function ensureCategory(name: string): string | null {
  const db = getDb();
  const slug = slugify(name, { lower: true, strict: true });
  const existing = db.prepare('SELECT id FROM categories WHERE name = ? OR slug = ?').get(name, slug) as any;
  if (existing) return existing.id;
  const id = uuid();
  try {
    db.prepare('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)').run(id, name, slug);
    return id;
  } catch (e: any) {
    // Slug race — fall back to the existing row.
    const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as any;
    return row?.id ?? null;
  }
}

function ensureBrand(name: string): string | null {
  const db = getDb();
  const slug = slugify(name, { lower: true, strict: true });
  const existing = db.prepare('SELECT id FROM brands WHERE name = ? OR slug = ?').get(name, slug) as any;
  if (existing) return existing.id;
  const id = uuid();
  try {
    db.prepare('INSERT INTO brands (id, name, slug) VALUES (?, ?, ?)').run(id, name, slug);
    return id;
  } catch (e: any) {
    const row = db.prepare('SELECT id FROM brands WHERE slug = ?').get(slug) as any;
    return row?.id ?? null;
  }
}

function uniqueSlug(base: string): string {
  const db = getDb();
  let slug = base;
  let n = 2;
  while (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}

function insertProduct(row: ImportRow, userId: string): RowOutcome {
  const db = getDb();
  const base: RowOutcome = { line: row.line, name: row.name, ok: false, warnings: row.warnings };

  const slug = uniqueSlug(slugify(row.name, { lower: true, strict: true }));
  if (!slug) return { ...base, error: 'could not slugify name' };

  const categoryId = ensureCategory(row.category);
  if (!categoryId) return { ...base, error: `could not resolve/create category "${row.category}"` };
  const brandId = row.brand ? ensureBrand(row.brand) : null;

  const inUrl = row.india_asin ? amazonUrl('in', row.india_asin) : '';
  const usUrl = row.us_asin ? amazonUrl('com', row.us_asin) : '';
  const legacyUrl = usUrl || inUrl;

  const id = uuid();
  const status = row.status === 'published' ? 'published' : 'draft';
  // Column/value pairs — literal-safe, no hand-counted placeholder lists.
  const cols: [string, unknown][] = [
    ['id', id], ['name', row.name], ['slug', slug], ['brand_id', brandId], ['category_id', categoryId],
    ['sku', ''], ['current_price', row.current_price ?? 0], ['previous_price', null],
    ['currency', row.currency], ['rating', row.rating ?? 0], ['review_count', row.review_count ?? 0],
    ['primary_image', row.primary_image || ''], ['gallery_images', '[]'], ['thumbnail', ''],
    ['image_alt', row.name], ['short_description', row.short_description || ''],
    ['full_description', ''], ['why_we_recommend', row.why_we_recommend || ''], ['best_for', row.best_for || ''],
    ['benefits', '[]'], ['pros', JSON.stringify(row.pros)], ['cons', JSON.stringify(row.cons)],
    ['buying_advice', row.buying_advice || ''], ['specifications', '{}'], ['tags', JSON.stringify(row.tags)],
    ['status', status], ['is_featured', 0], ['is_trending', 0], ['is_editors_pick', 0],
    ['affiliate_url', legacyUrl], ['marketplace', ''], ['affiliate_network', 'Amazon Associates'],
    ['tracking_id', ''], ['cta_text', 'Check Price'], ['global_affiliate_url', usUrl],
    ['global_affiliate_network', 'Amazon Associates'], ['global_tracking_id', 'alayainsider-20'],
    ['global_cta_label', 'Explore Global Options'], ['global_active', inUrl ? 1 : 0],
    ['india_affiliate_url', inUrl], ['india_affiliate_network', 'Amazon Associates'],
    ['india_tracking_id', 'alayainsider-21'], ['india_cta_label', 'Explore India'],
    ['india_active', inUrl ? 1 : 0], ['us_affiliate_url', usUrl], ['additional_retailers', '[]'],
    ['seo_title', row.seo_title || ''], ['seo_description', row.seo_description || ''],
    ['canonical_url', ''], ['focus_keyword', ''], ['created_by', userId],
    ['published_at', status === 'published' ? new Date().toISOString() : null],
  ];
  db.prepare(
    `INSERT INTO products (${cols.map(c => c[0]).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...cols.map(c => c[1]));

  db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), userId, 'imported', 'product', id, `Product "${row.name}" imported from CSV (${status})`);

  return { ...base, ok: true, slug };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await ensureDbReady();
    const body = await req.json();
    const csv = typeof body?.csv === 'string' ? body.csv : '';
    if (!csv.trim()) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 });
    }

    const parsed = parseImportCsv(csv);
    if (!parsed.rows.length) {
      return NextResponse.json({ error: 'No data rows found — check the header row' }, { status: 400 });
    }

    const db = getDb();
    const results: RowOutcome[] = [];
    const tx = db.transaction((userId: string) => {
      for (const row of parsed.rows) {
        if (row.errors.length) {
          results.push({ line: row.line, name: row.name, ok: false, error: row.errors.join('; ') });
          continue;
        }
        try {
          results.push(insertProduct(row, userId));
        } catch (e: any) {
          results.push({ line: row.line, name: row.name, ok: false, error: e?.message || 'insert failed' });
        }
      }
    });
    tx(user.id);

    const imported = results.filter(r => r.ok).length;
    return NextResponse.json({
      ok: true,
      imported,
      failed: results.length - imported,
      unknownColumns: parsed.unknownColumns,
      rows: results,
    }, { status: 200 });
  } catch (e: any) {
    console.error('Product import error:', e);
    return NextResponse.json({ error: 'Failed to import products' }, { status: 500 });
  }
}

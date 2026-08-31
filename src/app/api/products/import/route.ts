import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';

function parsePipedList(val: string | undefined): string[] {
  if (!val) return [];
  return val.split('|').map(s => s.trim()).filter(Boolean);
}

function toBool(val: string | undefined): number {
  if (!val) return 0;
  const v = val.toLowerCase().trim();
  return (v === 'yes' || v === 'true' || v === '1') ? 1 : 0;
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { products } = await req.json();
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products to import' }, { status: 400 });
    }

    const db = getDb();
    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    // Resolve brand / category by name
    const brandCache = new Map<string, string>();
    const catCache = new Map<string, string>();
    db.prepare('SELECT id, name FROM brands').all().forEach((b: any) => brandCache.set(b.name.toLowerCase(), b.id));
    db.prepare('SELECT id, name FROM categories').all().forEach((c: any) => catCache.set(c.name.toLowerCase(), c.id));

    // Use a transaction so product + affiliate link are atomic
    const importTxn = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO products (
          id, name, slug, brand_id, category_id, subcategory_id, sku,
          current_price, previous_price, currency,
          rating, review_count,
          short_description, why_we_recommend, best_for,
          benefits, pros, cons, buying_advice,
          affiliate_url, marketplace, affiliate_network, cta_text,
          seo_title, seo_description,
          status, is_featured, is_trending, is_editors_pick,
          created_by, published_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `);

      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        try {
          const name = (p.name || '').trim();
          if (!name) {
            results.errors.push(`Row ${i + 1}: Missing product name`);
            results.skipped++;
            continue;
          }

          const slug = slugify(name, { lower: true, strict: true });
          if (!slug) {
            results.errors.push(`Row ${i + 1}: Could not generate URL slug from "${name}"`);
            results.skipped++;
            continue;
          }
          const existing = db.prepare('SELECT id FROM products WHERE slug = ? OR (name = ? AND deleted_at IS NULL)').get(slug, name);
          if (existing) {
            results.errors.push(`Row ${i + 1}: "${name}" already exists`);
            results.skipped++;
            continue;
          }

          const id = uuid();
          const brandId = p.brand ? (brandCache.get(p.brand.toLowerCase()) || null) : null;
          const categoryId = p.category ? (catCache.get(p.category.toLowerCase()) || null) : null;
          const subcategoryId = p.subcategory ? (catCache.get(p.subcategory.toLowerCase()) || null) : null;
          const status = ['draft', 'published', 'archived'].includes(p.status) ? p.status : 'draft';

          stmt.run(
            id, name, slug, brandId, categoryId, subcategoryId, p.sku || '',
            parseFloat(p.price) || 0,
            p.previous_price ? parseFloat(p.previous_price) : null,
            p.currency || 'USD',
            parseFloat(p.rating) || 0,
            parseInt(p.review_count) || 0,
            p.description || '',
            p.why_we_recommend || '',
            p.best_for || '',
            JSON.stringify(parsePipedList(p.benefits)),
            JSON.stringify(parsePipedList(p.pros)),
          JSON.stringify(parsePipedList(p.cons)),
          p.buying_advice || '',
          p.affiliate_url || '',
          p.marketplace || '',
          p.affiliate_network || '',
          p.cta_text || 'Check Price',
          p.seo_title || '',
          p.seo_description || '',
          status,
          toBool(p.is_featured),
          toBool(p.is_trending),
          toBool(p.is_editors_pick),
          user.id,
          status === 'published' ? new Date().toISOString() : null
        );

        // Create affiliate link if URL provided — use a unique slug to avoid UNIQUE constraint collisions
        if (p.affiliate_url) {
          try {
            db.prepare(`
              INSERT INTO affiliate_links (id, product_id, slug, destination_url, marketplace, affiliate_network, is_active)
              VALUES (?, ?, ?, ?, ?, ?, 1)
            `).run(uuid(), id, `link-${slug}-${i}`, p.affiliate_url, p.marketplace || '', p.affiliate_network || '');
          } catch (linkErr: any) {
            // Don't let a broken affiliate link prevent the product from being counted
            results.errors.push(`Row ${i + 1}: Product imported but affiliate link failed: ${linkErr.message}`);
          }
        }

        results.imported++;
      } catch (e: any) {
        results.errors.push(`Row ${i + 1}: ${e.message}`);
        results.skipped++;
      }
    }
    });
    importTxn();

    db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, details) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), user.id, 'bulk_import', 'product', `Imported ${results.imported} products, ${results.skipped} skipped`);

    console.log(`[IMPORT] Results: imported=${results.imported}, skipped=${results.skipped}, errors=${results.errors.length}`);
    if (results.errors.length > 0) {
      console.log(`[IMPORT] Errors:`, results.errors.slice(0, 10));
    }
    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: 'Import failed: ' + e.message }, { status: 500 });
  }
}

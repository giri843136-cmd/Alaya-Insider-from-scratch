/**
 * Public API allow-list for product-shaped rows.
 *
 * Unauthenticated callers of the public read endpoints (GET /api/products,
 * /api/products/[id], /api/brands, /api/categories, /api/search) may only
 * receive the fields below. Commercial fields (current_price, previous_price,
 * currency, rating, review_count, live_*, price_updated_at, specifications,
 * sku, click/view counters, created_by/updated_by, deleted_at, tracking ids,
 * affiliate_network, …) never leave the server unauthenticated — full rows are
 * served only by the session-authenticated /api/admin/* endpoints.
 */
export const PUBLIC_PRODUCT_FIELDS = [
  'name',
  'slug',
  'brand_name',
  'category_name',
  'subcategory_name',
  'short_description',
  'seo_title',
  'seo_description',
  'primary_image',
  'image_alt',
  'cta_text',
  'amazon_in_url',
  'amazon_us_url',
  'published_at',
] as const;

/**
 * Project one row down to the public allow-list, dropping every other field.
 * `extra` lets an endpoint add a minimal set of structural fields it cannot
 * function without (e.g. categories need parent_id/sort_order to build a tree).
 */
export function publicProduct<T extends Record<string, any>>(
  row: T,
  extra: readonly string[] = [],
): Record<string, any> {
  const out: Record<string, any> = {};
  if (!row) return out;
  for (const field of [...PUBLIC_PRODUCT_FIELDS, ...extra]) {
    if (row[field] !== undefined) out[field] = row[field];
  }
  return out;
}

export function publicProducts(
  rows: Record<string, any>[],
  extra: readonly string[] = [],
): Record<string, any>[] {
  return (rows || []).map((r) => publicProduct(r, extra));
}

/**
 * schema.org Product JSON-LD builder.
 *
 * TASK 3 (Amazon compliance): no official price/rating source is wired into
 * structured data, so this builder must never ASSERT a price, price range,
 * availability, star rating or review count — `offers` (incl. the old
 * editorial-reference fallback) and `aggregateRating` are removed outright,
 * not merely omitted when data is missing. Only editorial facts are emitted:
 *   @type Product with name, description, brand, image (local only) and url.
 *
 * Price/rating-shaped inputs are accepted (callers still pass full product
 * rows) and deliberately ignored — a compile-time reminder that no caller
 * can accidentally reintroduce a commercial claim through this builder.
 */

export interface SchemaProductInput {
  name?: string;
  short_description?: string;
  brand_name?: string;
  primary_image?: string;
  slug?: string;
  /** Ignored on purpose — see module docblock. */
  live_price?: unknown;
  live_currency?: unknown;
  live_store?: unknown;
  current_price?: unknown;
  currency?: unknown;
  rating?: unknown;
  review_count?: unknown;
}

export function buildProductSchema(p: SchemaProductInput): Record<string, any> {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
  };
  if (p.short_description) schema.description = p.short_description;
  if (p.brand_name) schema.brand = { '@type': 'Brand', name: p.brand_name };

  // Image: local assets only. Relative /uploads paths are resolved against
  // NEXT_PUBLIC_SITE_URL when available; any off-site (Amazon/brand CDN)
  // URL is dropped rather than asserted in structured data.
  if (p.primary_image) {
    const img = String(p.primary_image);
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
    const isLocal = img.startsWith('/') || (!!site && img.startsWith(`${site}/`));
    if (isLocal) {
      schema.image = img.startsWith('/') && site ? `${site}${img}` : img;
    }
  }

  // Page URL (not the Amazon destination — that lives in the visible CTA).
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (p.slug && site) schema.url = `${site}/product/${p.slug}`;

  // Deliberately absent: offers (price/priceCurrency/availability),
  // aggregateRating (ratingValue/reviewCount), Review — see module docblock.
  return schema;
}

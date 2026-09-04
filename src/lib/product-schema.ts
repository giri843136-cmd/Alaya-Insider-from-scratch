/**
 * schema.org Product JSON-LD builder.
 *
 * Googlebot crawls from US IPs, so it sees the US rendering. To keep
 * structured data consistent, offers are always emitted for the SAME store
 * whose price is displayed on the request (never ₹ and $ mixed in one page),
 * and offers are cleanly OMITTED when no live price is available.
 */

export interface SchemaProductInput {
  name?: string;
  short_description?: string;
  brand_name?: string;
  live_price?: number | null;
  live_currency?: string | null;
  live_store?: 'in' | 'us';
  amazon_in_url?: string;
  amazon_us_url?: string;
  india_affiliate_url?: string;
  current_price?: number;
  currency?: string;
  rating?: number;
  review_count?: number;
}

export function buildProductSchema(p: SchemaProductInput): Record<string, any> {
  const hasLivePrice = p.live_price != null && p.live_price > 0;
  const store = p.live_store === 'us' ? 'us' : 'in';
  const offerUrl = store === 'us'
    ? (p.amazon_us_url || p.india_affiliate_url)
    : (p.amazon_in_url || p.india_affiliate_url);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
  };
  if (p.short_description) schema.description = p.short_description;
  if (p.brand_name) schema.brand = { '@type': 'Brand', name: p.brand_name };

  if (hasLivePrice) {
    schema.offers = {
      '@type': 'Offer',
      price: p.live_price,
      priceCurrency: p.live_currency || (store === 'us' ? 'USD' : 'INR'),
      availability: 'https://schema.org/InStock',
      ...(offerUrl ? { url: offerUrl } : {}),
    };
  } else if (p.current_price && p.current_price > 0) {
    // Editorial reference price (no live API data) — same single currency.
    schema.offers = {
      '@type': 'Offer',
      price: p.current_price,
      priceCurrency: p.currency || (store === 'us' ? 'USD' : 'INR'),
    };
  }
  // else: offers omitted entirely — invalid/empty offers are worse.

  if (p.rating && p.rating > 0 && p.review_count && p.review_count > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: p.rating,
      reviewCount: p.review_count,
    };
  }

  return schema;
}
/**
 * Product JSON-LD tests. Googlebot crawls from US IPs, so it sees the US
 * rendering. Offers must always use the SAME store whose price is displayed
 * (never ₹ and $ mixed in one page's schema) and must be omitted entirely when
 * no live price exists.
 */

import { buildProductSchema } from '../product-schema';

describe('buildProductSchema — store consistency', () => {
  it('US store → USD offers with the amazon.com URL', () => {
    const s = buildProductSchema({
      name: 'Watch', live_price: 49.99, live_currency: 'USD', live_store: 'us',
      amazon_us_url: 'https://www.amazon.com/dp/B0USASIN01?tag=alayainsider-20',
      amazon_in_url: 'https://www.amazon.in/dp/B0INASIN01?tag=alayainsider-21',
    });
    expect(s.offers.priceCurrency).toBe('USD');
    expect(s.offers.url).toContain('www.amazon.com');
    expect(JSON.stringify(s)).not.toContain('amazon.in');
  });

  it('India store → INR offers with the amazon.in URL', () => {
    const s = buildProductSchema({
      name: 'Watch', live_price: 1299.5, live_currency: 'INR', live_store: 'in',
      amazon_us_url: 'https://www.amazon.com/dp/B0USASIN01?tag=alayainsider-20',
      amazon_in_url: 'https://www.amazon.in/dp/B0INASIN01?tag=alayainsider-21',
    });
    expect(s.offers.priceCurrency).toBe('INR');
    expect(s.offers.url).toContain('www.amazon.in');
    expect(JSON.stringify(s)).not.toContain('amazon.com');
  });
});

describe('buildProductSchema — omit when no price', () => {
  it('no live price and no editorial price → offers key absent entirely', () => {
    const s = buildProductSchema({ name: 'Watch', live_price: null, live_currency: null });
    expect(s.offers).toBeUndefined();
    expect('offers' in s).toBe(false);
  });

  it('live price null but editorial reference price present → editorial offer with single currency', () => {
    const s = buildProductSchema({ name: 'Watch', live_price: null, current_price: 999, currency: 'INR' });
    expect(s.offers.price).toBe(999);
    expect(s.offers.priceCurrency).toBe('INR');
  });

  it('live price 0 / negative treated as no price', () => {
    expect(buildProductSchema({ name: 'A', live_price: 0 }).offers).toBeUndefined();
    expect(buildProductSchema({ name: 'A', live_price: -5 }).offers).toBeUndefined();
  });
});

describe('buildProductSchema — extras', () => {
  it('emits aggregateRating only when rating + review_count are positive', () => {
    const withRating = buildProductSchema({ name: 'A', rating: 4.5, review_count: 10 });
    expect(withRating.aggregateRating.ratingValue).toBe(4.5);
    const without = buildProductSchema({ name: 'A', rating: 0, review_count: 10 });
    expect(without.aggregateRating).toBeUndefined();
  });

  it('includes brand and description when present', () => {
    const s = buildProductSchema({ name: 'A', brand_name: 'Fossil', short_description: 'Nice watch' });
    expect(s.brand.name).toBe('Fossil');
    expect(s.description).toBe('Nice watch');
  });
});
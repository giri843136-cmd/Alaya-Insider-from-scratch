/**
 * Product JSON-LD tests — TASK 3 (Amazon compliance).
 *
 * The builder must NEVER assert a price, price range, availability, star
 * rating or review count: no `offers`, no `aggregateRating`, no Review
 * schema. Only editorial facts: name, description, brand, image (local
 * only), url. Whatever commercial fields a caller passes, they are ignored.
 */

import { buildProductSchema } from '../product-schema';

const FULL_COMMERCIAL_ROW = {
  name: 'Muji Aroma Diffuser',
  short_description: 'A quiet ultrasonic diffuser.',
  brand_name: 'MUJI',
  slug: 'muji-aroma-diffuser',
  primary_image: '/uploads/muji.jpg',
  // Commercial fields present in the input — must never leak into the schema:
  live_price: 49.99,
  live_currency: 'USD',
  live_store: 'us' as const,
  current_price: 199.95,
  currency: 'INR',
  rating: 4.8,
  review_count: 3456,
};

describe('buildProductSchema — no commercial claims (TASK 3)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('emits no offers and no aggregateRating even when price/rating fields are present', () => {
    const s = buildProductSchema(FULL_COMMERCIAL_ROW);
    expect(s.offers).toBeUndefined();
    expect('offers' in s).toBe(false);
    expect(s.aggregateRating).toBeUndefined();
    expect('aggregateRating' in s).toBe(false);
  });

  it('serialized JSON contains no price/availability/rating vocabulary', () => {
    const json = JSON.stringify(buildProductSchema(FULL_COMMERCIAL_ROW));
    expect(json).not.toMatch(/offers|price|priceCurrency|availability|ratingValue|reviewCount|aggregateRating|Review/);
  });

  it('keeps @type Product with name, description and brand', () => {
    const s = buildProductSchema(FULL_COMMERCIAL_ROW);
    expect(s['@type']).toBe('Product');
    expect(s.name).toBe('Muji Aroma Diffuser');
    expect(s.description).toBe('A quiet ultrasonic diffuser.');
    expect(s.brand).toEqual({ '@type': 'Brand', name: 'MUJI' });
  });

  it('image: local paths are kept (absolute via NEXT_PUBLIC_SITE_URL) and off-site URLs dropped', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://alayainsider.com';
    const s = buildProductSchema(FULL_COMMERCIAL_ROW);
    expect(s.image).toBe('https://alayainsider.com/uploads/muji.jpg');

    const amazon = buildProductSchema({ ...FULL_COMMERCIAL_ROW, primary_image: 'https://m.media-amazon.com/images/I/x.jpg' });
    expect(amazon.image).toBeUndefined();

    const otherBrand = buildProductSchema({ ...FULL_COMMERCIAL_ROW, primary_image: 'https://cdn.other.example/img.png' });
    expect(otherBrand.image).toBeUndefined();
  });

  it('emits the page url from NEXT_PUBLIC_SITE_URL, not the Amazon destination', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://alayainsider.com';
    const s = buildProductSchema(FULL_COMMERCIAL_ROW);
    expect(s.url).toBe('https://alayainsider.com/product/muji-aroma-diffuser');
  });

  it('omits url and image cleanly when inputs/site origin are absent', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const s = buildProductSchema({ name: 'A' });
    expect(s.url).toBeUndefined();
    expect(s.image).toBeUndefined();
    expect(s['@type']).toBe('Product');
  });

  it('with NO commercial inputs at all, still a valid minimal editorial Product', () => {
    const s = buildProductSchema({ name: 'Watch', short_description: 'Nice', brand_name: 'Fossil' });
    expect(s['@type']).toBe('Product');
    expect(JSON.stringify(s)).not.toMatch(/offers|price|rating|availability/i);
  });
});

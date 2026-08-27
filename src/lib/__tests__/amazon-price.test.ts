import { extractAsin } from '../amazon-price';

describe('extractAsin', () => {
  it('should extract ASIN from /dp/ URL', () => {
    expect(extractAsin('https://www.amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
  });

  it('should extract ASIN from /dp/ URL with query params', () => {
    expect(extractAsin('https://www.amazon.com/dp/B08N5WRWNW?tag=mytag-20')).toBe('B08N5WRWNW');
  });

  it('should extract ASIN from /gp/product/ URL', () => {
    expect(extractAsin('https://www.amazon.com/gp/product/B09V3KXJPB')).toBe('B09V3KXJPB');
  });

  it('should extract ASIN from /product/ URL', () => {
    expect(extractAsin('https://www.amazon.com/product/B07XJ8C8F5')).toBe('B07XJ8C8F5');
  });

  it('should extract ASIN from /ASIN/ URL', () => {
    expect(extractAsin('https://www.amazon.com/ASIN/B000000000')).toBe('B000000000');
  });

  it('should handle bare ASIN strings', () => {
    expect(extractAsin('B08N5WRWNW')).toBe('B08N5WRWNW');
  });

  it('should handle bare ASIN with lowercase', () => {
    expect(extractAsin('b08n5wrwnw')).toBe('B08N5WRWNW');
  });

  it('should return null for empty string', () => {
    expect(extractAsin('')).toBeNull();
  });

  it('should return null for non-ASIN string', () => {
    expect(extractAsin('not-an-asin')).toBeNull();
  });

  it('should return null for too-short string', () => {
    expect(extractAsin('B08N5')).toBeNull();
  });

  it('should return null for too-long string', () => {
    expect(extractAsin('B08N5WRWNW12')).toBeNull();
  });

  it('should return null for plain URL without ASIN', () => {
    expect(extractAsin('https://www.amazon.com/s?k=laptop')).toBeNull();
  });

  it('should extract ASIN from complex Amazon URL', () => {
    expect(
      extractAsin('https://www.amazon.com/Brand-Charging-Compatibility-Self-Adjusting-Protection/dp/B08N5WRWNW/ref=sr_1_1')
    ).toBe('B08N5WRWNW');
  });

  it('should handle India Amazon domain', () => {
    expect(extractAsin('https://www.amazon.in/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
  });

  it('should handle UK Amazon domain', () => {
    expect(extractAsin('https://www.amazon.co.uk/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
  });
});

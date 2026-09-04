/**
 * Verified amazon.in / amazon.com product-link fixes (audited live 2026-09-04).
 *
 * The seeded ASINs reused one fabricated string per product — invalid on both
 * marketplaces (19/20 dead on amazon.in, 18/20 dead on amazon.com). These maps
 * hold the replacements verified live (HTTP 200 + matching page title) and are
 * applied by the admin endpoint POST /api/products/apply-amazon-fixes (and
 * mirrored in scripts/fix-amazon-links.js for terminal use).
 */

export const IN_TAG = 'alayainsider-21';
export const US_TAG = 'alayainsider-20';

export const inUrl = (asin: string) => `https://www.amazon.in/dp/${asin}?tag=${IN_TAG}`;
export const usUrl = (asin: string) => `https://www.amazon.com/dp/${asin}?tag=${US_TAG}`;

/** slug → verified amazon.in ASIN (12) */
export const IN_FIXES: Record<string, string> = {
  'aesop-resurrection-hand-wash': 'B01MDVOM5S',
  'le-creuset-dutch-oven': 'B07MXNZNHN',
  'bang-olufsen-beoplay-h95': 'B09HC339ZG',
  'away-carry-on': 'B0DLJHS52R',
  'aesop-parsley-seed-cleanser': 'B008E55738',
  'le-creuset-stoneware-mug': 'B07MP6SZ8T',
  'bang-olufsen-beosound-a1': 'B0F3P1YSD2',
  'le-creuset-skillet': 'B01N0Z8AIZ',
  'away-everywhere-bag': 'B0DLHD8WHJ',
  'bang-olufsen-beoplay-ex': 'B09VLHYQMV',
  'aesop-geranium-body-cleanser': 'B003NTYTO8',
  'le-creuset-salt-pepper-mills': 'B0DWTB9Q6T',
};

/** slug → verified amazon.com ASIN (16) */
export const US_FIXES: Record<string, string> = {
  'muji-aroma-diffuser': 'B09361272Z',
  'aesop-resurrection-hand-wash': 'B01MDVOM5S',
  'le-creuset-dutch-oven': 'B00VWMFLQI',
  'bang-olufsen-beoplay-h95': 'B0916JNV9T',
  'away-carry-on': 'B0DLJ5CDB2',
  'aesop-parsley-seed-cleanser': 'B008E55738',
  'le-creuset-stoneware-mug': 'B003F24D1M',
  'bang-olufsen-beosound-a1': 'B085R7TSN6',
  'aesop-reverence-hand-balm': 'B00K0C6OUI',
  'le-creuset-skillet': 'B00B4UOKM4',
  'away-everywhere-bag': 'B0GS6Z1Y3W',
  'bang-olufsen-beoplay-ex': 'B09VLHYQMV',
  'aesop-geranium-body-cleanser': 'B00BJ2BUIO',
  'muji-stainless-steel-tumbler': 'B0753G1V5Z',
  'le-creuset-salt-pepper-mills': 'B00U00JMSQ',
  'away-toiletry-bag': 'B0FR9ZR4MW',
};

/** No amazon.com listing → neutralize the .com fallback (4) */
export const US_NEUTRALIZE: string[] = [
  'muji-cotton-bed-sheets',
  'muji-travel-organizer-set',
  'muji-led-desk-lamp',
  'muji-ultrasonic-humidifier',
];

/** No amazon.in listing AND no amazon.com listing → archive (4) */
export const ARCHIVE_NO_LISTING: string[] = [
  'muji-cotton-bed-sheets',
  'muji-travel-organizer-set',
  'muji-led-desk-lamp',
  'muji-ultrasonic-humidifier',
];

/** Valid amazon.com only (no amazon.in) → set to draft (4) */
export const DRAFT_COM_ONLY: string[] = [
  'muji-aroma-diffuser',
  'muji-stainless-steel-tumbler',
  'away-toiletry-bag',
  'aesop-reverence-hand-balm',
];
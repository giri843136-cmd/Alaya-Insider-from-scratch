/**
 * Bulk product import from CSV — parsing + validation (pure, no DB).
 *
 * Column spec (header row, case-insensitive; extra columns are ignored with a
 * warning, missing required columns are row errors):
 *
 *   name*            product name (required)
 *   category*        existing-or-new category name (required)
 *   brand            brand name (created if missing)
 *   short_description, why_we_recommend, best_for, buying_advice
 *   pros, cons, tags — pipe (|) separated lists
 *   primary_image    https URL of the main image
 *   india_asin       amazon.in ASIN (10 chars) — builds the amazon.in link
 *   us_asin          amazon.com ASIN (10 chars) — builds the amazon.com link
 *   current_price, currency, rating, review_count, status (draft|published)
 *   seo_title, seo_description
 *
 * Products are imported as drafts unless status=published. Every imported row
 * gets draft-safe defaults so nothing appears live before review.
 */

export const IMPORT_COLUMNS = [
  'name', 'category', 'brand', 'short_description', 'why_we_recommend',
  'best_for', 'pros', 'cons', 'tags', 'buying_advice', 'primary_image',
  'india_asin', 'us_asin', 'current_price', 'currency', 'rating',
  'review_count', 'status', 'seo_title', 'seo_description',
] as const;

const REQUIRED = ['name', 'category'] as const;

export const ASIN_RE = /^[A-Z0-9]{10}$/;

export interface ImportRow {
  line: number;
  name: string;
  category: string;
  brand: string;
  short_description: string;
  why_we_recommend: string;
  best_for: string;
  pros: string[];
  cons: string[];
  tags: string[];
  buying_advice: string;
  primary_image: string;
  india_asin: string | null;
  us_asin: string | null;
  current_price: number | null;
  currency: string;
  rating: number | null;
  review_count: number | null;
  status: 'draft' | 'published';
  seo_title: string;
  seo_description: string;
  errors: string[];
  warnings: string[];
}

export interface ImportResult {
  rows: ImportRow[];
  unknownColumns: string[];
}

/** Minimal RFC-4180-ish line splitter that respects quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function splitList(v: string): string[] {
  return v.split('|').map(s => s.trim()).filter(Boolean);
}

export function parseImportCsv(text: string): ImportResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const unknownColumns: string[] = [];
  const rows: ImportRow[] = [];

  // Find the header (first non-empty line).
  let headerIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      header = splitCsvLine(lines[i]).map(h => h.trim().toLowerCase());
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1 || !header.length) {
    return { rows, unknownColumns };
  }

  const known = new Set(IMPORT_COLUMNS.map(c => c.toLowerCase()));
  for (const h of header) {
    if (!known.has(h)) unknownColumns.push(h);
  }
  const col = (row: string[], name: string): string => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const cells = splitCsvLine(raw);
    if (cells.length === 1 && cells[0] === '') continue;

    const name = col(cells, 'name');
    const category = col(cells, 'category');
    const errors: string[] = [];
    if (!name) errors.push('missing name');
    if (!category) errors.push('missing category');

    const indiaAsin = col(cells, 'india_asin').toUpperCase() || null;
    const usAsin = col(cells, 'us_asin').toUpperCase() || null;
    if (indiaAsin && !ASIN_RE.test(indiaAsin)) errors.push(`invalid india_asin "${indiaAsin}"`);
    if (usAsin && !ASIN_RE.test(usAsin)) errors.push(`invalid us_asin "${usAsin}"`);
    if (!indiaAsin && !usAsin) errors.push('needs india_asin and/or us_asin');

    const status = col(cells, 'status').toLowerCase();
    if (status && status !== 'draft' && status !== 'published') {
      errors.push(`invalid status "${status}"`);
    }
    const num = (v: string): number | null => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const price = col(cells, 'current_price');
    const rating = col(cells, 'rating');
    const reviews = col(cells, 'review_count');
    const warnings: string[] = [];
    if (price && num(price) === null) warnings.push('current_price not numeric');
    if (rating && num(rating) === null) warnings.push('rating not numeric');
    if (reviews && num(reviews) === null) warnings.push('review_count not numeric');

    rows.push({
      line: i + 1,
      name,
      category,
      brand: col(cells, 'brand'),
      short_description: col(cells, 'short_description'),
      why_we_recommend: col(cells, 'why_we_recommend'),
      best_for: col(cells, 'best_for'),
      pros: splitList(col(cells, 'pros')),
      cons: splitList(col(cells, 'cons')),
      tags: splitList(col(cells, 'tags')),
      buying_advice: col(cells, 'buying_advice'),
      primary_image: col(cells, 'primary_image'),
      india_asin: indiaAsin,
      us_asin: usAsin,
      current_price: price ? num(price) : null,
      currency: col(cells, 'currency') || (indiaAsin ? 'INR' : 'USD'),
      rating: rating ? num(rating) : null,
      review_count: reviews ? num(reviews) : null,
      status: status === 'published' ? 'published' : 'draft',
      seo_title: col(cells, 'seo_title'),
      seo_description: col(cells, 'seo_description'),
      errors,
      warnings,
    });
  }

  return { rows, unknownColumns };
}

/** amazon URLs with the store partner tag — same shape the site renders. */
export function amazonUrl(marketplace: 'in' | 'com', asin: string): string {
  const tag = marketplace === 'in' ? 'alayainsider-21' : 'alayainsider-20';
  return `https://www.amazon.${marketplace}/dp/${asin}?tag=${tag}`;
}

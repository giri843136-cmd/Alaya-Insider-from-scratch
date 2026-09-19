/**
 * WAVE 0.5 — validation for admin product writes.
 *
 * Every failure returns a per-field message (field_errors, keyed by the exact
 * form field name) plus a flat errors array, so the editor can point the
 * operator at the input that needs fixing instead of a generic "Failed to
 * create product".
 *
 * Commercial fields (current_price, previous_price, rating, review_count,
 * currency) are EXPLICITLY allowed to be absent (null): the admin must be
 * able to save without inventing prices or ratings (TASK 4 / WAVE 0.5 step 8).
 * An explicit 0 is stored as 0. Fabricated defaults are never applied here.
 * There is no `in_stock` column in the products schema — stock state is
 * expressed via the `status` CHECK values, so nothing is accepted or written
 * for it.
 */

export const PRODUCT_STATUSES = [
  'draft',
  'in_review',
  'ready',
  'published',
  'archived',
  'out_of_stock',
  'expired',
] as const;

export interface ProductValidationResult {
  field_errors: Record<string, string>;
  errors: string[];
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;

/** Absent (undefined / null / '') -> null. Otherwise a finite number. */
export function optionalNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Absent -> null; otherwise a finite integer. */
export function optionalInteger(v: unknown): number | null {
  const n = optionalNumber(v);
  if (n === null) return null;
  return Number.isInteger(n) ? n : null;
}

/**
 * Draft-safety validation: only what an INSERT/UPDATE literally cannot
 * survive without, plus type/range checks on the fields the form does send.
 * Nothing here demands prices or ratings.
 *
 * `requireName` is for CREATE (POST): the name must be present. On UPDATE
 * (PUT) fields are merged over the existing row, so an ABSENT name is legal
 * (e.g. the editor's status-only "Archive" PUT) — only an explicitly empty
 * one is an error.
 */
export function validateProductDraft(
  data: any,
  opts: { requireName?: boolean } = {},
): ProductValidationResult {
  const field_errors: Record<string, string> = {};

  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  if (!name && (opts.requireName === true || data?.name !== undefined)) {
    field_errors['name'] = 'Product name is required';
  }

  if (data?.slug !== undefined && data.slug !== null && data.slug !== '' && !SLUG_RE.test(String(data.slug))) {
    field_errors['slug'] = 'Slug may only contain lowercase letters, numbers and hyphens';
  }

  if (data?.status !== undefined && data.status !== null && data.status !== '' && !PRODUCT_STATUSES.includes(data.status)) {
    field_errors['status'] = `Status must be one of: ${PRODUCT_STATUSES.join(', ')}`;
  }

  const price = optionalNumber(data?.current_price);
  if (data?.current_price !== undefined && data?.current_price !== null && data?.current_price !== '' && price === null) {
    field_errors['current_price'] = 'Current price must be a number (leave it empty or 0 if unknown — it is never rendered publicly)';
  } else if (price !== null && price < 0) {
    field_errors['current_price'] = 'Current price cannot be negative';
  }

  const prev = optionalNumber(data?.previous_price);
  if (data?.previous_price !== undefined && data?.previous_price !== null && data?.previous_price !== '' && prev === null) {
    field_errors['previous_price'] = 'Previous price must be a number or empty';
  } else if (prev !== null && prev < 0) {
    field_errors['previous_price'] = 'Previous price cannot be negative';
  }

  const rating = optionalNumber(data?.rating);
  if (data?.rating !== undefined && data?.rating !== null && data?.rating !== '' && rating === null) {
    field_errors['rating'] = 'Rating must be a number between 0 and 5';
  } else if (rating !== null && (rating < 0 || rating > 5)) {
    field_errors['rating'] = 'Rating must be between 0 and 5';
  }

  const reviews = optionalInteger(data?.review_count);
  if (data?.review_count !== undefined && data?.review_count !== null && data?.review_count !== '' && reviews === null) {
    field_errors['review_count'] = 'Review count must be a whole number of 0 or more';
  } else if (reviews !== null && reviews < 0) {
    field_errors['review_count'] = 'Review count cannot be negative';
  }

  if (data?.currency !== undefined && data?.currency !== null && data?.currency !== '' && !CURRENCY_RE.test(String(data.currency))) {
    field_errors['currency'] = 'Currency must be a 3-letter code like USD or INR';
  }

  return { field_errors, errors: Object.values(field_errors) };
}

/**
 * Publish validation — our own stricter standard, enforced server-side.
 * Messages are identical to the editor's publish modal so the operator sees
 * the same list before and after the request.
 */
export function validateProductPublish(data: any, existing: any): string[] {
  const val = (k: string) => {
    const v = data?.[k];
    return v === undefined || v === null ? existing?.[k] : v;
  };
  const errors: string[] = [];

  const name = String(val('name') ?? '').trim();
  const img = val('primary_image');
  const cat = val('category_id');
  const brand = val('brand_id');
  const desc = val('short_description');
  const why = val('why_we_recommend');
  const seoT = val('seo_title');
  const seoD = val('seo_description');
  const gUrl = val('global_affiliate_url');
  const iUrl = val('india_affiliate_url');
  const gActive = data?.global_active !== undefined ? data.global_active : existing?.global_active;
  const iActive = data?.india_active !== undefined ? data.india_active : existing?.india_active;

  if (!name) errors.push('Product name is required');
  if (!img) errors.push('Primary image is required');
  if (!cat) errors.push('Category is required');
  if (!brand) errors.push('Brand is required');
  if (!desc) errors.push('Description is required');
  if (!why) errors.push('Why We Recommend It is required');
  if (!seoT) errors.push('SEO title is required');
  if (!seoD) errors.push('Meta description is required');
  if (!(gActive && gUrl) && !(iActive && iUrl)) errors.push('At least one affiliate destination is required');

  return errors;
}

/**
 * Foreign-key existence checks with operator-readable messages — a stale or
 * hand-edited select value must fail with "pick one from the list", not a
 * FOREIGN KEY constraint error (500).
 */
export function validateReferences(
  db: { prepare: (sql: string) => { get: (...a: any[]) => any } },
  data: any,
): Record<string, string> {
  const field_errors: Record<string, string> = {};
  const checks: Array<[string, string, string]> = [
    ['brand_id', 'brands', 'Selected brand does not exist — choose a brand from the list'],
    ['category_id', 'categories', 'Selected category does not exist — choose a category from the list'],
    ['subcategory_id', 'categories', 'Selected subcategory does not exist — choose a subcategory from the list'],
  ];
  for (const [field, table, message] of checks) {
    const v = data?.[field];
    if (v === undefined || v === null || v === '') continue;
    const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(v);
    if (!row) field_errors[field] = message;
  }
  return field_errors;
}

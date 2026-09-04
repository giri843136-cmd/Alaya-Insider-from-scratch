/**
 * Live-price display helpers. Pure functions so they can be imported by
 * server components (SSR) and client components alike.
 *
 * Prices come from the Amazon Creators API for the India marketplace and are
 * amounts in INR. We format with Intl so currency symbols/grouping are right
 * (₹1,299.00) and never hand-roll "$" signs (the old code hardcoded USD).
 */

const CURRENCY_DEFAULT = 'INR';

/** Format an amount for display, e.g. 1299 → "₹1,299.00". */
export function formatLiveAmount(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || isNaN(amount)) return '';
  const cur = currency || CURRENCY_DEFAULT;
  try {
    // en-IN gives Indian digit grouping (1,29,900) which is what INR prices
    // use on Amazon.in; other currencies fall back to en-US style grouping.
    const locale = cur === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${cur} ${Number(amount).toFixed(2)}`;
  }
}

/**
 * Short "as of" label for a price, e.g. "as of 3 Sep 2026, 1:30 pm IST".
 * Amazon policy: prices must refresh at least hourly OR carry an as-of stamp —
 * we do both (1-hour cache + this stamp on product pages).
 */
export function asOfLabel(fetchedAtMs: number | null | undefined): string {
  if (!fetchedAtMs || isNaN(fetchedAtMs)) return '';
  const d = new Date(fetchedAtMs);
  try {
    const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    return `as of ${date}, ${time} IST`;
  } catch {
    return `as of ${d.toISOString()}`;
  }
}

/**
 * Derive the display fields pages attach to enriched products.
 * Consumer components should read product.live_price / product.live_currency /
 * product.live_fetched_at / product.live_available.
 */
export function liveDisplayFields(live: { price: number | null; currency?: string | null; available?: boolean; fetchedAt?: number | null } | null | undefined) {
  if (!live) {
    return { live_price: null, live_currency: null, live_fetched_at: null, live_available: false };
  }
  const price = live.price ?? null;
  const hasPrice = price !== null && price > 0;
  return {
    live_price: price,
    // Without a real price the display fields are empty so callers can cleanly
    // fall back to "Check price on Amazon" text (and omit schema price data).
    live_currency: hasPrice ? live.currency || CURRENCY_DEFAULT : null,
    live_fetched_at: hasPrice ? live.fetchedAt ?? null : null,
    live_available: hasPrice && !!live.available,
  };
}

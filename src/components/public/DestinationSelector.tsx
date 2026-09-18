'use client';

import PaidLinkTag from './PaidLinkTag';

interface Props { product: any; compact?: boolean; }

/**
 * Shopping destination selector.
 *
 * Product links are rendered as DIRECT amazon.in / amazon.com anchors (no
 * internal /go/ redirector; affiliate URLs stay direct and tagged).
 * rel/target are kept on every anchor. Clicks are tracked by a
 * fire-and-forget beacon that does NOT replace the anchor — the href stays a
 * direct Amazon URL.
 *
 * The enriched product carries amazon_in_url / amazon_us_url (direct, tagged)
 * and live_store (which store the visitor's geo resolves to). No price data
 * is displayed anywhere in this component (TASK 5): the only pricing copy is
 * the single honest pattern mandated by the compliance runbook.
 */
export default function DestinationSelector({ product, compact = false }: Props) {
  const p = product;
  const indiaActive = p.india_active && (p.amazon_in_url || p.india_affiliate_url);
  const usActive = p.amazon_us_url || (p.global_active && p.global_affiliate_url);
  const primaryStore = p.live_store || 'in';

  if (!indiaActive && !usActive) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-400">Shopping links are temporarily unavailable.</p>
      </div>
    );
  }

  const handleClick = async (destination: string, store: string) => {
    try {
      await fetch('/api/clicks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: p.id,
          destination_type: destination,
          store,
          source_page: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      });
    } catch {}
  };

  const storeLabel = primaryStore === 'us' ? 'Amazon.com' : 'Amazon.in';
  const storeFlag = primaryStore === 'us' ? '🇺🇸' : '🇮🇳';

  // TASK 5 — the one honest pricing pattern. No live/reference/price-claim
  // copy anywhere in this component.
  const honestPriceNote =
    "We don't publish prices here — Amazon's price changes constantly. Tap to see today's price and availability.";
  // Exact FTC/Amazon Associates disclosure sentence, adjacent to every CTA.
  const associateDisclosure = 'As an Amazon Associate I earn from qualifying purchases.';

  return (
    <div className={compact ? '' : 'my-10'}>
      <div className={compact ? 'mb-4' : 'mb-6'}>
        <h2 className={`font-semibold text-accent ${compact ? 'text-base' : 'text-[17px]'}`}>Buy on Amazon</h2>
        <p className="text-[13px] text-gray-400 mt-1">
          {primaryStore === 'us'
            ? 'Opens the US store — Amazon.com.'
            : 'Opens the India store — Amazon.in.'}
        </p>
      </div>

      <div className={`grid gap-4 ${indiaActive && usActive ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
        {/* Primary store (visitor's geo store) */}
        {primaryStore === 'us' && usActive ? (
          <a
            href={p.amazon_us_url || p.global_affiliate_url}
            target="_blank" rel="noopener noreferrer nofollow sponsored"
            onClick={() => handleClick('global', 'us')}
            className="group block rounded-xl border p-5 transition-all duration-200 hover:shadow-md border-accent/15 bg-accent/[0.015] hover:border-accent/30"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-accent/[0.04] flex items-center justify-center flex-shrink-0">
                <span className="text-lg">{storeFlag}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-accent/35 uppercase tracking-[0.1em]">United States</span>
                <h3 className="text-[15px] font-semibold text-accent mt-0.5 leading-snug">Shop on Amazon.com</h3>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">{honestPriceNote}</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 bg-accent text-white text-[13px] font-medium rounded-lg group-hover:bg-accent-light transition-colors">
                  Check price on Amazon.com
                </div>
                <PaidLinkTag className="mt-1.5" />
              </div>
            </div>
          </a>
        ) : indiaActive ? (
          <a
            href={p.amazon_in_url || p.india_affiliate_url}
            target="_blank" rel="noopener noreferrer nofollow sponsored"
            onClick={() => handleClick('india', 'in')}
            className="group block rounded-xl border p-5 transition-all duration-200 hover:shadow-md border-accent/15 bg-accent/[0.015] hover:border-accent/30"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-accent/[0.04] flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🇮🇳</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-accent/35 uppercase tracking-[0.1em]">India</span>
                <h3 className="text-[15px] font-semibold text-accent mt-0.5 leading-snug">Shop on Amazon.in</h3>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">{honestPriceNote}</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 bg-accent text-white text-[13px] font-medium rounded-lg group-hover:bg-accent-light transition-colors">
                  Check price on Amazon.in
                </div>
                <PaidLinkTag className="mt-1.5" />
              </div>
            </div>
          </a>
        ) : null}

        {/* Secondary store */}
        {primaryStore === 'in' && usActive && (
          <a
            href={p.amazon_us_url || p.global_affiliate_url}
            target="_blank" rel="noopener noreferrer nofollow sponsored"
            onClick={() => handleClick('global', 'us')}
            className="group block rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300 bg-white"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-sage/[0.08] flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🇺🇸</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-sage uppercase tracking-[0.1em]">United States</span>
                <h3 className="text-[15px] font-semibold text-accent mt-0.5 leading-snug">Shop on Amazon.com</h3>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">{honestPriceNote}</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 border border-accent text-accent text-[13px] font-medium rounded-lg group-hover:bg-accent group-hover:text-white transition-colors">
                  Check price on Amazon.com
                </div>
                <PaidLinkTag className="mt-1.5" />
              </div>
            </div>
          </a>
        )}

        {primaryStore === 'us' && indiaActive && (
          <a
            href={p.amazon_in_url || p.india_affiliate_url}
            target="_blank" rel="noopener noreferrer nofollow sponsored"
            onClick={() => handleClick('india', 'in')}
            className="group block rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300 bg-white"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-sage/[0.08] flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🇮🇳</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-sage uppercase tracking-[0.1em]">India</span>
                <h3 className="text-[15px] font-semibold text-accent mt-0.5 leading-snug">Shop on Amazon.in</h3>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">{honestPriceNote}</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 border border-accent text-accent text-[13px] font-medium rounded-lg group-hover:bg-accent group-hover:text-white transition-colors">
                  Check price on Amazon.in
                </div>
                <PaidLinkTag className="mt-1.5" />
              </div>
            </div>
          </a>
        )}
      </div>

      <p className="text-[14px] text-gray-400 mt-4">{honestPriceNote}</p>
      {/* TASK 27: disclosure must be >=14px and >=4.5:1 against its background
          (was text-[11px] text-gray-400). text-[14px] font-medium on white is
          ~7.0:1. Compliance tests assert these classes. */}
      <p className="text-[14px] font-medium text-gray-600 mt-1">{associateDisclosure}</p>
    </div>
  );
}
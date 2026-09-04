'use client';

import PaidLinkTag from './PaidLinkTag';

interface Props { product: any; compact?: boolean; }

/**
 * Shopping destination selector.
 *
 * OneLink compatibility (critical): product links are rendered as DIRECT
 * amazon.in / amazon.com anchors (no /go/ internal redirector) so OneLink's
 * JavaScript can rewrite them for the 9 secondary marketplaces. rel/target are
 * kept on every anchor. Clicks are tracked by a fire-and-forget beacon that
 * does NOT replace the anchor — the href stays a direct Amazon URL.
 *
 * The enriched product carries amazon_in_url / amazon_us_url (direct, tagged)
 * and live_price/live_currency/live_store from the visitor's geo store.
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

  return (
    <div className={compact ? '' : 'my-10'}>
      <div className={compact ? 'mb-4' : 'mb-6'}>
        <h2 className={`font-semibold text-accent ${compact ? 'text-base' : 'text-[17px]'}`}>Buy on Amazon</h2>
        <p className="text-[13px] text-gray-400 mt-1">
          {primaryStore === 'us'
            ? 'Showing the US store with live pricing from Amazon.com.'
            : 'Showing the India store with live pricing from Amazon.in.'}
          {primaryStore !== 'us' && usActive && ' US visitors see $ pricing on Amazon.com when the product has a US listing.'}
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
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">Live $ pricing and availability from the US store.</p>
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
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">Live ₹ pricing and availability from the India store.</p>
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
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">$ pricing on the US store — also the OneLink target for other countries.</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 border border-accent text-accent text-[13px] font-medium rounded-lg group-hover:bg-accent group-hover:text-white transition-colors">
                  Check price on Amazon.com
                </div>
                <PaidLinkTag className="mt-1.5" />
                <p className="text-[10px] text-gray-300 mt-2.5">OneLink redirects to your local store where supported.</p>
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
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">₹ pricing on the India store.</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 border border-accent text-accent text-[13px] font-medium rounded-lg group-hover:bg-accent group-hover:text-white transition-colors">
                  Check price on Amazon.in
                </div>
                <PaidLinkTag className="mt-1.5" />
              </div>
            </div>
          </a>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-4">Prices shown are approximate and may vary. Click a shopping button above to see the current price on Amazon.</p>
    </div>
  );
}
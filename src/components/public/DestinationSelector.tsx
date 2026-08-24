'use client';

interface Props { product: any; compact?: boolean; }

export default function DestinationSelector({ product, compact = false }: Props) {
  const p = product;
  const globalActive = p.global_active && p.global_affiliate_url;
  const indiaActive = p.india_active && p.india_affiliate_url;

  if (!globalActive && !indiaActive) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-400">Shopping links are temporarily unavailable.</p>
      </div>
    );
  }

  const handleClick = async (destination: string) => {
    try {
      await fetch('/api/clicks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: p.id, destination_type: destination, source_page: typeof window !== 'undefined' ? window.location.pathname : '' }),
      });
    } catch {}
  };

  return (
    <div className={compact ? '' : 'my-10'}>
      <div className={compact ? 'mb-4' : 'mb-6'}>
        <h2 className={`font-semibold text-accent ${compact ? 'text-base' : 'text-[17px]'}`}>Choose Your Shopping Destination</h2>
        <p className="text-[13px] text-gray-400 mt-1">Select the shopping experience that works best for you.</p>
      </div>

      <div className={`grid gap-4 ${globalActive && indiaActive ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
        {/* Global */}
        {globalActive && (
          <a href={`/go/${p.slug}?destination=global`} target="_blank" rel="noopener noreferrer nofollow"
            onClick={() => handleClick('global')}
            className={`group block rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${
              indiaActive ? 'border-accent/15 bg-accent/[0.015] hover:border-accent/30' : 'border-gray-200 hover:border-gray-300'
            }`}>
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-accent/[0.04] flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-accent/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-accent/35 uppercase tracking-[0.1em]">Global Shopping</span>
                <h3 className="text-[15px] font-semibold text-accent mt-0.5 leading-snug">Shop Worldwide</h3>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">One smart link takes you to the Amazon store available in your region.</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 bg-accent text-white text-[13px] font-medium rounded-lg group-hover:bg-accent-light transition-colors">
                  {p.global_cta_label || 'Explore Global Options'}
                  <svg className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
                <p className="text-[10px] text-gray-300 mt-2.5">Automatically routed where supported.</p>
              </div>
            </div>
          </a>
        )}

        {/* India */}
        {indiaActive && (
          <a href={`/go/${p.slug}?destination=india`} target="_blank" rel="noopener noreferrer nofollow"
            onClick={() => handleClick('india')}
            className="group block rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300 bg-white">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-sage/[0.08] flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-sage uppercase tracking-[0.1em]">India Shopping</span>
                <h3 className="text-[15px] font-semibold text-accent mt-0.5 leading-snug">Shop in India</h3>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">Explore local availability and pricing through our India shopping experience.</p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2 border border-accent text-accent text-[13px] font-medium rounded-lg group-hover:bg-accent group-hover:text-white transition-colors">
                  {p.india_cta_label || 'Explore India'}
                  <svg className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
                <p className="text-[10px] text-gray-300 mt-2.5">Local pricing and availability may vary.</p>
              </div>
            </div>
          </a>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-4">Prices shown are approximate and may vary. Click a shopping button above to see the current price on Amazon.</p>
    </div>
  );
}

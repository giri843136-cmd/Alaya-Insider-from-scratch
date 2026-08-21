import Link from 'next/link';

interface Props { product: any; }

export function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-px">
        {[1,2,3,4,5].map(i => (
          <svg key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-[11px] text-gray-400">{rating} ({count.toLocaleString()})</span>
    </div>
  );
}

export default function ProductCard({ product }: Props) {
  const p = product;
  return (
    <Link href={`/product/${p.slug}`}
      className="group block bg-white rounded-[10px] overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200">
      <div className="aspect-[4/3] bg-ivory relative overflow-hidden">
        {p.primary_image ? (
          <img src={p.primary_image} alt={p.image_alt || p.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
        {p.is_editors_pick ? (
          <span className="absolute top-2.5 left-2.5 bg-plum text-white text-[10px] font-medium px-2.5 py-[3px] rounded-full tracking-wide">Editor&apos;s Pick</span>
        ) : p.is_trending ? (
          <span className="absolute top-2.5 left-2.5 bg-accent text-white text-[10px] font-medium px-2.5 py-[3px] rounded-full tracking-wide">Trending</span>
        ) : null}
      </div>
      <div className="p-4">
        {p.brand_name && <p className="text-[10px] font-semibold text-warm uppercase tracking-[0.1em] mb-1.5">{p.brand_name}</p>}
        <h3 className="text-[13px] font-medium text-gray-800 line-clamp-2 leading-snug mb-2 group-hover:text-accent transition-colors">{p.name}</h3>
        <StarRating rating={p.rating} count={p.review_count} />
        <div className="flex items-baseline gap-2 mt-2.5">
          <span className="text-[15px] font-semibold text-accent">${p.current_price?.toFixed(2)}</span>
          {p.previous_price && p.previous_price > p.current_price && (
            <span className="text-xs text-gray-400 line-through">${p.previous_price.toFixed(2)}</span>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-50">
          <span className="text-[12px] text-accent font-medium group-hover:underline">View Product →</span>
        </div>
      </div>
    </Link>
  );
}

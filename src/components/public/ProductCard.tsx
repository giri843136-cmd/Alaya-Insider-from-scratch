import Link from 'next/link';
import PaidLinkTag from './PaidLinkTag';

interface Props { product: any; }


export default function ProductCard({ product }: Props) {
  const p = product;
  const hasAffiliate = (p.global_active && p.global_affiliate_url) || (p.india_active && p.india_affiliate_url);

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
        <div className="mt-2.5">
          <span className="text-[12px] text-gray-400 italic">Check current price on Amazon</span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-50">
          <span className="text-[12px] text-accent font-medium group-hover:underline">View Product →</span>
          {hasAffiliate && <PaidLinkTag className="ml-1.5" />}
        </div>
      </div>
    </Link>
  );
}

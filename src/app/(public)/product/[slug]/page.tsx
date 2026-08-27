import { notFound } from 'next/navigation';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import ProductCard, { StarRating } from '@/components/public/ProductCard';
import NewsletterBox from '@/components/public/NewsletterBox';
import ProductCTA from './ProductCTA';
import PaidLinkTag from '@/components/public/PaidLinkTag';
import { getLivePrice, extractAsin } from '@/lib/amazon-price';
import type { Metadata } from 'next';

export const revalidate = 120; // Cache product pages 2 minutes

async function getProduct(slug: string) {
  ensureDbReady();
  const db = getDb();
  const product = db.prepare(`SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name, c.slug as category_slug, sc.name as subcategory_name
    FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN categories sc ON p.subcategory_id = sc.id
    WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL`).get(slug) as any;
  if (!product) return null;

  // Safely parse JSON fields — handles double-stringified data
  const safeParse = (val: any, fallback: any = []) => {
    if (Array.isArray(val)) return val;
    if (typeof val !== 'string' || !val) return fallback;
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'string') {
        try { return JSON.parse(parsed); } catch { return fallback; }
      }
      return parsed;
    } catch { return fallback; }
  };

  // Fetch live price from Amazon Creators API
  const asin = extractAsin(product.global_affiliate_url || product.affiliate_url || '') || product.sku;
  let livePrice: number | null = null;
  if (asin) {
    try {
      const priceData = await getLivePrice(asin);
      livePrice = priceData.price;
    } catch {
      // Live price fetch failed — will show fallback UI
    }
  }

  const related = db.prepare(`SELECT p.*, b.name as brand_name, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.id != ? AND p.status = 'published' AND p.deleted_at IS NULL LIMIT 4`).all(product.category_id, product.id);

  // Fetch live prices for related products
  const relatedWithPrices = await Promise.all(related.map(async (rp: any) => {
    const rpAsin = extractAsin(rp.global_affiliate_url || rp.affiliate_url || '') || rp.sku;
    let rpLivePrice: number | null = null;
    if (rpAsin) {
      try {
        const rpPriceData = await getLivePrice(rpAsin);
        rpLivePrice = rpPriceData.price;
      } catch {}
    }
    return { ...rp, live_price: rpLivePrice };
  }));

  return {
    product: {
      ...product,
      benefits: safeParse(product.benefits),
      pros: safeParse(product.pros),
      cons: safeParse(product.cons),
      tags: safeParse(product.tags),
      specifications: safeParse(product.specifications, {}),
      live_price: livePrice,
    },
    related: relatedWithPrices,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) return { title: 'Product Not Found' };
  const p = data.product;
  return { title: p.seo_title || `${p.name} — Alaya Insider`, description: p.seo_description || p.short_description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();
  const { product, related } = data;
  const isAvailable = product.status === 'published';
  const disclosure = (() => { const db = getDb(); return (db.prepare("SELECT value FROM site_settings WHERE key = 'affiliate_disclosure'").get() as any)?.value || ''; })();

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[
        { label: 'Products', href: '/products' },
        ...(product.category_name ? [{ label: product.category_name, href: `/category/${product.category_slug}` }] : []),
        { label: product.name },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
        {/* Image */}
        <div className="aspect-square bg-ivory rounded-xl overflow-hidden">
          {product.primary_image ? (
            <img src={product.primary_image} alt={product.image_alt || product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-200">
              <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.brand_name && <p className="text-xs font-medium text-warm uppercase tracking-wider mb-2">{product.brand_name}</p>}
          <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-3">{product.name}</h1>
          <div className="mb-4"><StarRating rating={product.rating} count={product.review_count} /></div>
          <div className="flex items-baseline gap-3 mb-2">
            {product.live_price != null && product.live_price > 0 ? (
              <span className="text-2xl font-semibold text-accent">${product.live_price.toFixed(2)}</span>
            ) : (
              <span className="text-lg text-gray-400 italic">Check current price on Amazon</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mb-6">Prices shown are for reference and may vary. Click the shopping button below to see the latest price on Amazon.</p>

          {!isAvailable && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800 font-medium">Currently unavailable</p>
              <p className="text-sm text-amber-600 mt-1">Check back later or view similar products below.</p>
            </div>
          )}

          {product.short_description && <p className="text-gray-600 leading-relaxed mb-6">{product.short_description}</p>}

          {product.why_we_recommend && (
            <div className="bg-ivory rounded-lg p-5 mb-6">
              <h2 className="text-sm font-semibold text-accent mb-2">Why We Recommend It</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{product.why_we_recommend}</p>
            </div>
          )}

          {product.best_for && (
            <div className="mb-5"><h3 className="text-sm font-semibold text-accent mb-1">Best For</h3><p className="text-sm text-gray-600">{product.best_for}</p></div>
          )}

          {product.benefits.length > 0 && (
            <div className="mb-6"><h3 className="text-sm font-semibold text-accent mb-2">Key Benefits</h3>
              <ul className="space-y-1">{product.benefits.map((b: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm text-gray-600"><span className="text-sage mt-0.5">✓</span> {b}</li>)}</ul>
            </div>
          )}

          {/* Destination Selector */}
          {isAvailable && <ProductCTA product={product} />}
          <PaidLinkTag className="mt-1" />
        </div>
      </div>

      {/* Pros / Cons */}
      {(product.pros.length > 0 || product.cons.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-14">
          {product.pros.length > 0 && (
            <div className="bg-sage/5 rounded-lg p-6 border border-sage/10">
              <h3 className="text-sm font-semibold text-sage mb-3">What We Like</h3>
              <ul className="space-y-2">{product.pros.map((p: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm text-gray-600"><span className="text-sage mt-0.5">+</span> {p}</li>)}</ul>
            </div>
          )}
          {product.cons.length > 0 && (
            <div className="bg-red-50/50 rounded-lg p-6 border border-red-100/50">
              <h3 className="text-sm font-semibold text-red-700/70 mb-3">What to Know</h3>
              <ul className="space-y-2">{product.cons.map((c: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm text-gray-600"><span className="text-red-400 mt-0.5">−</span> {c}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {product.buying_advice && (
        <div className="bg-ivory rounded-lg p-6 mb-14 max-w-narrow">
          <h2 className="text-base font-semibold text-accent mb-2">Buying Advice</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{product.buying_advice}</p>
        </div>
      )}

      {related.length > 0 && (
        <div className="mb-14">
          <h2 className="text-lg font-semibold text-accent mb-6">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {disclosure && (
        <div className="bg-gray-50 rounded-lg p-4 mb-8">
          <p className="text-xs text-gray-400">{disclosure}</p>
        </div>
      )}

      <NewsletterBox source="product_page" compact />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "Product", "name": product.name,
        "description": product.short_description,
        "brand": product.brand_name ? { "@type": "Brand", "name": product.brand_name } : undefined,
        "offers": { "@type": "Offer", "price": product.live_price ?? product.current_price, "priceCurrency": product.currency || "USD",
          "availability": isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
        ...(product.rating > 0 && product.review_count > 0 ? { "aggregateRating": { "@type": "AggregateRating", "ratingValue": product.rating, "reviewCount": product.review_count } } : {}),
      })}} />
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import { StarRating } from '@/components/public/ProductCard';
import PaidLinkTag from '@/components/public/PaidLinkTag';
import { enrichProductsWithLivePrice } from '@/lib/amazon-price';
import { formatLiveAmount } from '@/lib/price-format';

const priceText = (p: any) => (p.live_price != null && p.live_price > 0 ? formatLiveAmount(p.live_price, p.live_currency) : 'Check price on Amazon');

export const revalidate = 120; // Cache comparison pages 2 minutes

export default async function ComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const { slug } = await params;
  const db = getDb();

  const comparison = db.prepare('SELECT * FROM comparisons WHERE slug = ?').get(slug) as any;
  if (!comparison) notFound();

  const productIds = JSON.parse(comparison.product_ids || '[]');
  const rawProducts = productIds.length
    ? db.prepare(`
        SELECT p.*, b.name as brand_name, b.slug as brand_slug
        FROM products p LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.id IN (${productIds.map(() => '?').join(',')})
      `).all(...productIds).map((p: any) => ({
        ...p,
        pros: JSON.parse(p.pros || '[]'),
        cons: JSON.parse(p.cons || '[]'),
        benefits: JSON.parse(p.benefits || '[]'),
      }))
    : [];

  // Fetch live Amazon.in prices for compared products (batched, 1h cache)
  const products = await enrichProductsWithLivePrice(rawProducts);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Comparisons' }, { label: comparison.title }]} />
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-2">{comparison.title}</h1>
      {comparison.description && <p className="text-gray-500 mb-10">{comparison.description}</p>}

      {products.length >= 2 && (
        <>
          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-6">
            {products.map((p: any) => (
              <div key={p.id} className="border border-gray-100 rounded-lg p-5">
                <p className="text-xs text-gray-400 uppercase mb-1">{p.brand_name}</p>
                <h3 className="font-semibold text-accent mb-2">{p.name}</h3>
                <p className="text-lg font-semibold mb-2">{priceText(p)}</p>
                <StarRating rating={p.rating} count={p.review_count} />
                {p.best_for && <p className="text-sm text-gray-600 mt-3"><strong>Best for:</strong> {p.best_for}</p>}
                {p.pros[0] && <p className="text-sm text-green-700 mt-2">+ {p.pros[0]}</p>}
                {p.cons[0] && <p className="text-sm text-red-700 mt-1">− {p.cons[0]}</p>}
                <Link href={`/go/${p.slug}`} target="_blank" rel="noopener noreferrer nofollow sponsored"
                  className="mt-4 inline-block px-5 py-2 bg-accent text-white text-sm rounded-md">
                  {p.cta_text || 'Check Price'}
                </Link>
                <PaidLinkTag className="mt-1" />
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border border-gray-100 rounded-lg overflow-hidden text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-4 font-medium text-gray-500 w-40">Feature</th>
                  {products.map((p: any) => (
                    <th key={p.id} className="text-left p-4 font-semibold text-accent">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="p-4 text-gray-500">Brand</td>
                  {products.map((p: any) => <td key={p.id} className="p-4">{p.brand_name}</td>)}
                </tr>
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td className="p-4 text-gray-500">Price</td>
                  {products.map((p: any) => <td key={p.id} className="p-4 font-semibold">{priceText(p)}</td>)}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="p-4 text-gray-500">Rating</td>
                  {products.map((p: any) => <td key={p.id} className="p-4">{p.rating} / 5 ({p.review_count})</td>)}
                </tr>
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td className="p-4 text-gray-500">Best For</td>
                  {products.map((p: any) => <td key={p.id} className="p-4">{p.best_for || '—'}</td>)}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="p-4 text-gray-500">Top Advantage</td>
                  {products.map((p: any) => <td key={p.id} className="p-4 text-green-700">{p.pros[0] || '—'}</td>)}
                </tr>
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td className="p-4 text-gray-500">Main Limitation</td>
                  {products.map((p: any) => <td key={p.id} className="p-4 text-red-700">{p.cons[0] || '—'}</td>)}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="p-4 text-gray-500">Action</td>
                  {products.map((p: any) => (
                    <td key={p.id} className="p-4">
                      <Link href={`/go/${p.slug}`} target="_blank" rel="noopener noreferrer nofollow sponsored"
                        className="inline-block px-4 py-2 bg-accent text-white text-xs rounded-md hover:bg-accent-light transition-colors">
                        {p.cta_text || 'Check Price'}
                      </Link>
                      <PaidLinkTag className="mt-1" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

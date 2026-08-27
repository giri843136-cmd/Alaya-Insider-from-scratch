import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';

export const revalidate = 300; // Cache brands listing 5 minutes
export const metadata = { title: 'Brands — Alaya Insider' };

export default function BrandsPage() {
  ensureDbReady();
  const brands = getDb().prepare(`
    SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.status = 'published' AND p.deleted_at IS NULL) as product_count
    FROM brands b ORDER BY b.name
  `).all() as any[];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Brands' }]} />
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-8">Brands</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {brands.map(b => (
          <Link key={b.id} href={`/brand/${b.slug}`}
            className="group border border-gray-100 rounded-lg p-6 hover:border-gray-200 hover:shadow-sm transition-all">
            <h2 className="text-base font-semibold text-accent group-hover:underline">{b.name}</h2>
            {b.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{b.description}</p>}
            <p className="text-xs text-gray-400 mt-2">{b.product_count} products</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

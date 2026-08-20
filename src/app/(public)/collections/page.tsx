import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Collections — Alaya Insider' };

export default function CollectionsPage() {
  ensureDbReady();
  const collections = getDb().prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM collection_products cp WHERE cp.collection_id = c.id) as product_count
    FROM collections c WHERE c.is_active = 1 ORDER BY c.sort_order
  `).all() as any[];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Collections' }]} />
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-2">Collections</h1>
      <p className="text-gray-500 mb-8">Curated product selections for every need.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map(c => (
          <Link key={c.id} href={`/collections/${c.slug}`}
            className="group border border-gray-100 rounded-lg p-6 hover:border-gray-200 hover:shadow-sm transition-all">
            <h2 className="text-lg font-semibold text-accent group-hover:underline">{c.name}</h2>
            {c.description && <p className="text-sm text-gray-500 mt-2 line-clamp-3">{c.description}</p>}
            <p className="text-xs text-gray-400 mt-3">{c.product_count} products</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

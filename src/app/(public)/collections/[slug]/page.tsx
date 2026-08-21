import { notFound } from 'next/navigation';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import ProductCard from '@/components/public/ProductCard';

export const dynamic = 'force-dynamic';

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const { slug } = await params;
  const db = getDb();
  const collection = db.prepare('SELECT * FROM collections WHERE slug = ? AND is_active = 1').get(slug) as any;
  if (!collection) notFound();

  const products = db.prepare(`
    SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name
    FROM collection_products cp
    JOIN products p ON cp.product_id = p.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE cp.collection_id = ? AND p.status = 'published' AND p.deleted_at IS NULL
    ORDER BY cp.sort_order
  `).all(collection.id);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Collections', href: '/collections' }, { label: collection.name }]} />
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-2">{collection.name}</h1>
      {collection.description && <p className="text-gray-500 mb-8">{collection.description}</p>}
      {products.length === 0 ? (
        <p className="text-gray-500 py-10">No products in this collection yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}

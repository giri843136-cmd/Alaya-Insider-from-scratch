import { notFound } from 'next/navigation';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import ProductCard from '@/components/public/ProductCard';

export const dynamic = 'force-dynamic';

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const { slug } = await params;
  const db = getDb();
  const brand = db.prepare('SELECT * FROM brands WHERE slug = ?').get(slug) as any;
  if (!brand) notFound();

  const products = db.prepare(`
    SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name
    FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.brand_id = ? AND p.status = 'published' AND p.deleted_at IS NULL
    ORDER BY p.is_featured DESC, p.created_at DESC
  `).all(brand.id);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Brands', href: '/brands' }, { label: brand.name }]} />
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-2">{brand.name}</h1>
      {brand.description && <p className="text-gray-500 mb-8">{brand.description}</p>}
      {products.length === 0 ? (
        <p className="text-gray-500 py-10">No products from this brand yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}

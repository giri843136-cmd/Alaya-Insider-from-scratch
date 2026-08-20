import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import ProductCard from '@/components/public/ProductCard';
import NewsletterBox from '@/components/public/NewsletterBox';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  ensureDbReady();
  const { slug } = await params;
  const cat = getDb().prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as any;
  if (!cat) return { title: 'Category Not Found' };
  return {
    title: cat.seo_title || `${cat.name} — Alaya Insider`,
    description: cat.seo_description || cat.description,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const { slug } = await params;
  const db = getDb();

  const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as any;
  if (!category) notFound();

  const subcategories = db.prepare('SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order').all(category.id);

  // Get products in this category or its subcategories
  const products = db.prepare(`
    SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE (p.category_id = ? OR p.subcategory_id = ? OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?))
      AND p.status = 'published' AND p.deleted_at IS NULL
    ORDER BY p.is_featured DESC, p.created_at DESC
  `).all(category.id, category.id, category.id);

  const parentCategory = category.parent_id
    ? db.prepare('SELECT name, slug FROM categories WHERE id = ?').get(category.parent_id) as any
    : null;

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[
        { label: 'Categories', href: '/categories' },
        ...(parentCategory ? [{ label: parentCategory.name, href: `/category/${parentCategory.slug}` }] : []),
        { label: category.name },
      ]} />

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-accent">{category.name}</h1>
        {category.description && <p className="text-gray-500 mt-2">{category.description}</p>}
      </div>

      {subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {(subcategories as any[]).map((sub: any) => (
            <Link key={sub.id} href={`/category/${sub.slug}`}
              className="text-sm px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-md text-gray-600 hover:border-accent hover:text-accent transition-colors">
              {sub.name}
            </Link>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500">No products in this category yet</p>
          <Link href="/products" className="text-sm text-accent underline mt-2 inline-block">Browse all products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p: any) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <div className="mt-16">
        <NewsletterBox source="category_page" />
      </div>
    </div>
  );
}

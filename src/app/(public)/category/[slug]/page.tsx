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

  const subcategories = db.prepare(
    'SELECT id, name, slug, description, image FROM categories WHERE parent_id = ? ORDER BY sort_order'
  ).all(category.id) as any[];

  // Get products in this category or its subcategories
  const products = db.prepare(`
    SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE (p.category_id = ? OR p.subcategory_id = ? OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?))
      AND p.status = 'published' AND p.deleted_at IS NULL
    ORDER BY p.is_featured DESC, p.created_at DESC
  `).all(category.id, category.id, category.id) as any[];

  const parentCategory = category.parent_id
    ? db.prepare('SELECT name, slug FROM categories WHERE id = ?').get(category.parent_id) as any
    : null;

  // JSON-LD breadcrumb
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Categories', href: '/categories' },
    ...(parentCategory ? [{ label: parentCategory.name, href: `/category/${parentCategory.slug}` }] : []),
    { label: category.name },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `https://alayainsider.com${item.href}` } : {}),
    })),
  };

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[
        { label: 'Categories', href: '/categories' },
        ...(parentCategory ? [{ label: parentCategory.name, href: `/category/${parentCategory.slug}` }] : []),
        { label: category.name },
      ]} />

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-accent">{category.name}</h1>
        {category.description && <p className="text-gray-500 mt-2 max-w-xl">{category.description}</p>}
      </div>

      {/* Subcategory navigation tiles */}
      {subcategories.length > 0 && (
        <div className="mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {subcategories.map((sub: any) => (
              <Link
                key={sub.id}
                href={`/category/${sub.slug}`}
                className="group block rounded-lg overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <div className="aspect-[4/3] bg-ivory overflow-hidden">
                  {sub.image ? (
                    <img src={sub.image} alt={sub.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-800 group-hover:text-accent transition-colors">{sub.name}</h3>
                  {sub.description && <p className="text-[11px] text-gray-400 mt-0.5">{sub.description}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      {products.length === 0 ? (
        <div className="text-center py-20 bg-ivory/50 rounded-xl">
          <div className="max-w-sm mx-auto">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-base font-semibold text-gray-600 mb-2">Something good is coming</h3>
            <p className="text-sm text-gray-400 mb-4">We&apos;re curating the best finds for this collection.</p>
            {parentCategory ? (
              <Link href={`/category/${parentCategory.slug}`} className="text-sm text-accent underline underline-offset-2">
                Explore the wider {parentCategory.name} edit
              </Link>
            ) : (
              <Link href="/products" className="text-sm text-accent underline underline-offset-2">Browse all products</Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between mb-5">
            <h2 className="text-base font-semibold text-accent">
              {subcategories.length > 0 ? 'All Products' : `${category.name} Products`}
            </h2>
            <span className="text-xs text-gray-400">{products.length} find{products.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}

      <div className="mt-16">
        <NewsletterBox source="category_page" />
      </div>
    </div>
  );
}

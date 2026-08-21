import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categories — Alaya Insider' };

export default function CategoriesPage() {
  ensureDbReady();
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published' AND p.deleted_at IS NULL) as product_count
    FROM categories c WHERE c.parent_id IS NULL ORDER BY c.sort_order, c.name
  `).all() as any[];

  const children = db.prepare('SELECT * FROM categories WHERE parent_id IS NOT NULL ORDER BY sort_order, name').all() as any[];
  const childMap: Record<string, any[]> = {};
  children.forEach((c: any) => {
    if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
    childMap[c.parent_id].push(c);
  });

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Categories' }]} />
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-8">Categories</h1>

      <div className="space-y-8">
        {categories.map(cat => (
          <div key={cat.id} className="border-b border-gray-100 pb-8">
            <Link href={`/category/${cat.slug}`} className="group">
              <h2 className="text-lg font-semibold text-accent group-hover:underline">{cat.name}</h2>
            </Link>
            {cat.description && <p className="text-sm text-gray-500 mt-1">{cat.description}</p>}
            {childMap[cat.id] && (
              <div className="flex flex-wrap gap-2 mt-3">
                {childMap[cat.id].map((child: any) => (
                  <Link key={child.id} href={`/category/${cat.slug}/${child.slug}`}
                    className="text-sm px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-md text-gray-600 hover:border-accent hover:text-accent transition-colors">
                    {child.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

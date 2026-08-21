import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import NewsletterBox from '@/components/public/NewsletterBox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Journal — Alaya Insider', description: 'Buying guides, reviews, and product recommendations.' };

export default function JournalPage() {
  ensureDbReady();
  const db = getDb();

  const articles = db.prepare(`
    SELECT a.*, ac.name as category_name, ac.slug as category_slug,
           u.first_name || ' ' || u.last_name as author_name
    FROM articles a
    LEFT JOIN article_categories ac ON a.category_id = ac.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.status = 'published' AND a.deleted_at IS NULL
    ORDER BY a.published_at DESC
  `).all() as any[];

  const categories = db.prepare('SELECT * FROM article_categories ORDER BY name').all() as any[];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Journal' }]} />
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent mb-2">The Journal</h1>
      <p className="text-gray-500 mb-8">Guides, reviews, and inspiration to help you choose well.</p>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((c: any) => (
            <Link key={c.id} href={`/journal?category=${c.slug}`}
              className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-gray-600 hover:border-accent hover:text-accent transition-colors">
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {articles.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">No articles published yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((a: any) => (
            <Link key={a.id} href={`/journal/${a.slug}`} className="group block">
              <div className="aspect-[16/9] bg-gray-100 rounded-lg mb-4 overflow-hidden">
                {a.featured_image && (
                  <img src={a.featured_image} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
              {a.category_name && (
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{a.category_name}</p>
              )}
              <h2 className="text-base font-medium text-gray-800 group-hover:text-accent transition-colors line-clamp-2 mb-2">
                {a.title}
              </h2>
              {a.subtitle && <p className="text-sm text-gray-500 line-clamp-2 mb-2">{a.subtitle}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {a.author_name && <span>{a.author_name}</span>}
                {a.reading_time > 0 && <span>{a.reading_time} min read</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-16">
        <NewsletterBox source="journal" />
      </div>
    </div>
  );
}

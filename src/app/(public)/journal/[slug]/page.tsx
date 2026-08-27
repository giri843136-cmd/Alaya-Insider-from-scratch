import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import NewsletterBox from '@/components/public/NewsletterBox';
import type { Metadata } from 'next';

export const revalidate = 300; // Cache articles 5 minutes

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  ensureDbReady();
  const { slug } = await params;
  const article = getDb().prepare("SELECT * FROM articles WHERE slug = ? AND deleted_at IS NULL").get(slug) as any;
  if (!article) return { title: 'Article Not Found' };
  return {
    title: article.seo_title || `${article.title} — Alaya Insider`,
    description: article.seo_description || article.excerpt,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const { slug } = await params;
  const db = getDb();

  const article = db.prepare(`
    SELECT a.*, ac.name as category_name, ac.slug as category_slug,
           u.first_name || ' ' || u.last_name as author_name
    FROM articles a
    LEFT JOIN article_categories ac ON a.category_id = ac.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.slug = ? AND a.deleted_at IS NULL
  `).get(slug) as any;

  if (!article) notFound();

  const relatedArticles = db.prepare(`
    SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, ac.name as category_name
    FROM articles a LEFT JOIN article_categories ac ON a.category_id = ac.id
    WHERE a.category_id = ? AND a.id != ? AND a.status = 'published' AND a.deleted_at IS NULL
    LIMIT 3
  `).all(article.category_id, article.id);

  const disclosure = (db.prepare("SELECT value FROM site_settings WHERE key = 'affiliate_disclosure'").get() as any)?.value || '';
  const publishedDate = article.published_at ? new Date(article.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <article className="max-w-narrow mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[
        { label: 'Journal', href: '/journal' },
        ...(article.category_name ? [{ label: article.category_name, href: `/journal?category=${article.category_slug}` }] : []),
        { label: article.title },
      ]} />

      <header className="mb-10">
        {article.category_name && (
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{article.category_name}</p>
        )}
        <h1 className="text-3xl sm:text-4xl font-semibold text-accent leading-tight mb-3">{article.title}</h1>
        {article.subtitle && (
          <p className="text-lg text-gray-500 mb-4">{article.subtitle}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {article.author_name && <span>By {article.author_name}</span>}
          {publishedDate && <span>{publishedDate}</span>}
          {article.reading_time > 0 && <span>{article.reading_time} min read</span>}
        </div>
      </header>

      {article.featured_image && (
        <div className="aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden mb-10">
          <img src={article.featured_image} alt={article.title} className="w-full h-full object-cover" />
        </div>
      )}

      {disclosure && (
        <div className="bg-gray-50 rounded-md p-4 mb-8">
          <p className="text-xs text-gray-400">{disclosure}</p>
        </div>
      )}

      <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />

      <div className="border-t border-gray-100 mt-12 pt-12">
        <NewsletterBox source="article" />
      </div>

      {relatedArticles.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-accent mb-6">Related Articles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {(relatedArticles as any[]).map((a: any) => (
              <Link key={a.id} href={`/journal/${a.slug}`} className="group">
                <div className="aspect-[16/9] bg-gray-100 rounded-lg mb-3 overflow-hidden">
                  {a.featured_image && <img src={a.featured_image} alt={a.title} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <h3 className="text-sm font-medium text-gray-800 group-hover:text-accent line-clamp-2">{a.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": article.excerpt,
        "author": article.author_name ? { "@type": "Person", "name": article.author_name } : undefined,
        "datePublished": article.published_at,
        "dateModified": article.updated_at,
      })}} />
    </article>
  );
}

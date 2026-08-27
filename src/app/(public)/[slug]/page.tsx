import { notFound } from 'next/navigation';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import type { Metadata } from 'next';

export const revalidate = 3600; // Legal pages rarely change — cache 1 hour

const LEGAL_SLUGS = ['affiliate-disclosure', 'privacy-policy', 'terms', 'cookie-policy'];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!LEGAL_SLUGS.includes(slug)) return { title: 'Page Not Found' };
  ensureDbReady();
  const page = getDb().prepare('SELECT * FROM pages WHERE slug = ?').get(slug) as any;
  if (!page) return { title: 'Page Not Found' };
  return { title: page.seo_title || `${page.title} — Alaya Insider` };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LEGAL_SLUGS.includes(slug)) notFound();

  ensureDbReady();
  const page = getDb().prepare('SELECT * FROM pages WHERE slug = ?').get(slug) as any;
  if (!page) notFound();

  // Ensure Amazon disclosure is present on affiliate-disclosure page
  const amazonDisclosure = '<p><strong>As an Amazon Associate I earn from qualifying purchases.</strong></p>';
  const contentHtml = slug === 'affiliate-disclosure' && !page.content.includes('Amazon Associate')
    ? amazonDisclosure + page.content
    : page.content;

  return (
    <div className="max-w-narrow mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: page.title }]} />
      <h1 className="text-3xl font-semibold text-accent mb-6">{page.title}</h1>
      <div className="article-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      <p className="text-xs text-gray-400 mt-8">Last updated: {new Date(page.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
  );
}

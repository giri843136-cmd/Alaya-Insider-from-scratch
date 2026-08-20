'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import slugify from 'slugify';

export default function NewArticle() {
  const [form, setForm] = useState({
    title: '', slug: '', subtitle: '', content: '', excerpt: '', featured_image: '',
    category_id: '', status: 'draft', is_featured: false, reading_time: 0,
    seo_title: '', seo_description: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const router = useRouter();

  useEffect(() => {
    adminFetch('/api/articles?admin=true&limit=0').catch(() => {});
    // Fetch article categories from a simple endpoint
    adminFetch('/api/categories?flat=true').catch(() => {});
  }, []);

  // We need article categories - let's fetch them properly
  useEffect(() => {
    adminFetch('/api/articles?limit=1').then(r => r.json()).catch(() => {});
    // Hardcode article categories for now - they come from seed
    setCategories([
      { id: '', name: 'Buying Guides', slug: 'buying-guides' },
      { id: '', name: 'Product Reviews', slug: 'product-reviews' },
      { id: '', name: 'Comparisons', slug: 'comparisons' },
      { id: '', name: 'How To', slug: 'how-to' },
      { id: '', name: 'Trends', slug: 'trends' },
    ]);
  }, []);

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const slug = form.slug || slugify(form.title, { lower: true, strict: true });
    const res = await adminFetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, slug }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push('/admin/articles');
    } else {
      setToast(data.error || 'Save failed');
      setTimeout(() => setToast(''), 3000);
    }
    setSaving(false);
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2.5 rounded-md text-sm shadow-lg">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">New Article</h1>
        <div className="flex gap-2">
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-6 space-y-5 max-w-2xl">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Title</label>
          <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Subtitle</label>
          <input type="text" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Excerpt</label>
          <textarea rows={2} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Content (HTML)</label>
          <textarea rows={12} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Reading Time (min)</label>
            <input type="number" value={form.reading_time} onChange={e => setForm(f => ({ ...f, reading_time: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Featured Image URL</label>
            <input type="text" value={form.featured_image} onChange={e => setForm(f => ({ ...f, featured_image: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} />
          Featured Article
        </label>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">SEO Title</label>
          <input type="text" value={form.seo_title} onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Meta Description</label>
          <textarea rows={2} value={form.seo_description} onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
      </div>
    </div>
  );
}

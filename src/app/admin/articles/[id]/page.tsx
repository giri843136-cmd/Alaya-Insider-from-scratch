'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function EditArticle() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminFetch(`/api/articles/${id}`).then(r => r.json()).then(d => {
      if (d.article) setForm(d.article);
    });
  }, [id]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const res = await adminFetch(`/api/articles/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { setToast('Saved'); setTimeout(() => setToast(''), 3000); }
    setSaving(false);
  };

  if (!form) return <p className="text-gray-400 text-sm">Loading...</p>;

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Edit Article</h1>
        <div className="flex gap-2">
          <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
            <option value="draft">Draft</option><option value="published">Published</option>
          </select>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg p-6 space-y-5 max-w-2xl">
        <div><label className="text-sm font-medium mb-1 block">Title</label>
          <input type="text" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
        <div><label className="text-sm font-medium mb-1 block">Subtitle</label>
          <input type="text" value={form.subtitle || ''} onChange={e => setForm((f: any) => ({ ...f, subtitle: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
        <div><label className="text-sm font-medium mb-1 block">Excerpt</label>
          <textarea rows={2} value={form.excerpt || ''} onChange={e => setForm((f: any) => ({ ...f, excerpt: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
        <div><label className="text-sm font-medium mb-1 block">Content (HTML)</label>
          <textarea rows={12} value={form.content || ''} onChange={e => setForm((f: any) => ({ ...f, content: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono" /></div>
        <div><label className="text-sm font-medium mb-1 block">SEO Title</label>
          <input type="text" value={form.seo_title || ''} onChange={e => setForm((f: any) => ({ ...f, seo_title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
        <div><label className="text-sm font-medium mb-1 block">Meta Description</label>
          <textarea rows={2} value={form.seo_description || ''} onChange={e => setForm((f: any) => ({ ...f, seo_description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
      </div>
    </div>
  );
}

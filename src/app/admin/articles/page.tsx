'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminArticles() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/articles?admin=true').then(r => r.json()).then(d => { setArticles(d.articles || []); setLoading(false); });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this article?')) return;
    await adminFetch(`/api/articles/${id}`, { method: 'DELETE' });
    setArticles(a => a.filter(x => x.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Articles</h1>
        <Link href="/admin/articles/new" className="px-4 py-2 bg-accent text-white text-sm rounded-md">New Article</Link>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Title</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Category</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Status</th>
              <th className="p-3 text-right text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Loading...</td></tr> :
            articles.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">No articles</td></tr> :
            articles.map(a => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3"><Link href={`/admin/articles/${a.id}`} className="font-medium text-gray-800 hover:text-accent">{a.title}</Link></td>
                <td className="p-3 text-gray-500 hidden sm:table-cell">{a.category_name || '—'}</td>
                <td className="p-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{a.status}</span>
                </td>
                <td className="p-3 text-right">
                  <Link href={`/admin/articles/${a.id}`} className="text-xs text-gray-400 hover:text-accent mr-3">Edit</Link>
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-gray-400 hover:text-red-500">Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

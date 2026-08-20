'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect } from 'react';
import slugify from 'slugify';

export default function AdminCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [toast, setToast] = useState('');

  const fetchCategories = async () => {
    const res = await adminFetch('/api/categories?flat=true');
    const data = await res.json();
    setCategories(data.categories || []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSave = async () => {
    if (!editing?.name) return;
    const slug = editing.slug || slugify(editing.name, { lower: true, strict: true });
    const method = editing.id ? 'PUT' : 'POST';
    const url = editing.id ? `/api/categories/${editing.id}` : '/api/categories';

    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editing, slug }),
    });

    if (res.ok) {
      showToast(editing.id ? 'Category updated' : 'Category created');
      setEditing(null);
      fetchCategories();
    } else {
      const data = await res.json();
      showToast(data.error || 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await adminFetch(`/api/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted');
    fetchCategories();
  };

  const parents = categories.filter(c => !c.parent_id);

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Categories</h1>
        <button onClick={() => setEditing({ name: '', slug: '', description: '', parent_id: '', is_featured: false })}
          className="px-4 py-2 bg-accent text-white text-sm rounded-md">Add Category</button>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editing.id ? 'Edit' : 'New'} Category</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
                <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <textarea rows={2} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Parent</label>
                <select value={editing.parent_id || ''} onChange={e => setEditing({ ...editing, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                  <option value="">None (top-level)</option>
                  {parents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={editing.is_featured || false}
                  onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} />
                Featured
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-accent text-white text-sm rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Name</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Parent</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Products</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Featured</th>
              <th className="p-3 text-right text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No categories</td></tr>
            ) : (
              categories.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">
                    {c.parent_id && <span className="text-gray-300 mr-2">└</span>}
                    {c.name}
                  </td>
                  <td className="p-3 text-gray-500 hidden sm:table-cell">{c.parent_name || '—'}</td>
                  <td className="p-3 text-gray-500 hidden md:table-cell">{c.product_count || 0}</td>
                  <td className="p-3 hidden md:table-cell">{c.is_featured ? '✓' : ''}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(c)} className="text-xs text-gray-400 hover:text-accent mr-3">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

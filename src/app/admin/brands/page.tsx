'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect } from 'react';
import slugify from 'slugify';

export default function AdminBrands() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [toast, setToast] = useState('');

  const fetchBrands = async () => {
    const res = await adminFetch('/api/brands');
    const data = await res.json();
    setBrands(data.brands || []);
    setLoading(false);
  };

  useEffect(() => { fetchBrands(); }, []);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSave = async () => {
    if (!editing?.name) { showToast('Brand name is required'); return; }
    const slug = editing.slug || slugify(editing.name, { lower: true, strict: true });
    const method = editing.id ? 'PUT' : 'POST';
    const url = editing.id ? `/api/brands/${editing.id}` : '/api/brands';
    try {
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify({ ...editing, slug }),
      });
      if (res.ok) {
        showToast(editing.id ? 'Brand updated' : 'Brand created');
        setEditing(null);
        fetchBrands();
      } else if (res.status === 401) {
        showToast('Session expired — please sign in again');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Save failed — please try again');
      }
    } catch {
      showToast('Unable to save — check your connection');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brand?')) return;
    await adminFetch(`/api/brands/${id}`, { method: 'DELETE' });
    showToast('Brand deleted');
    fetchBrands();
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Brands</h1>
        <button onClick={() => setEditing({ name: '', description: '', website_url: '', is_featured: false })}
          className="px-4 py-2 bg-accent text-white text-sm rounded-md">Add Brand</button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editing.id ? 'Edit' : 'New'} Brand</h2>
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1 block">Name</label>
                <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Description</label>
                <textarea rows={2} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              <div><label className="text-sm font-medium mb-1 block">Website URL</label>
                <input type="url" value={editing.website_url || ''} onChange={e => setEditing({ ...editing, website_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={editing.is_featured || false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} />
                Featured
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-accent text-white text-sm rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Brand</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Products</th>
              <th className="p-3 text-right text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="p-8 text-center text-gray-400">Loading...</td></tr> :
            brands.map(b => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3">
                  <p className="font-medium text-gray-800">{b.name}</p>
                  {b.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{b.description}</p>}
                </td>
                <td className="p-3 text-gray-500 hidden sm:table-cell">{b.product_count || 0}</td>
                <td className="p-3 text-right">
                  <button onClick={() => setEditing(b)} className="text-xs text-gray-400 hover:text-accent mr-3">Edit</button>
                  <button onClick={() => handleDelete(b.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

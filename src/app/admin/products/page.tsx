'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ admin: 'true', page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    const res = await adminFetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(data.products || []);
    setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"? This can be undone.`)) return;
    await adminFetch(`/api/products/${id}`, { method: 'DELETE' });
    showToast(`"${name}" archived`);
    fetchProducts();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Archive ${selected.size} products?`)) return;
    for (const id of Array.from(selected)) {
      await adminFetch(`/api/products/${id}`, { method: 'DELETE' });
    }
    setSelected(new Set());
    showToast(`${selected.size} products archived`);
    fetchProducts();
  };

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map(p => p.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Products</h1>
          <p className="text-sm text-gray-400">{pagination.total} total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products/new"
            className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-light transition-colors">
            Add Product
          </Link>
          <Link href="/admin/products/import"
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:border-accent transition-colors">
            Import
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search products..."
          className="px-3 py-2 border border-gray-200 rounded-md text-sm flex-1 max-w-xs" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete}
            className="px-3 py-2 border border-red-200 text-red-600 text-sm rounded-md hover:bg-red-50">
            Archive ({selected.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-3 text-left w-10">
                  <input type="checkbox" checked={selected.size === products.length && products.length > 0}
                    onChange={toggleAll} className="rounded" />
                </th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Brand</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Category</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Status</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Clicks</th>
                <th className="p-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="p-3" colSpan={8}><div className="skeleton h-5 w-full" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">No products found</td></tr>
              ) : (
                products.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <Link href={`/admin/products/${p.id}`} className="font-medium text-gray-800 hover:text-accent">
                        {p.name}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-500 hidden sm:table-cell">{p.brand_name || '—'}</td>
                    <td className="p-3 text-gray-500 hidden md:table-cell">{p.category_name || '—'}</td>
                    <td className="p-3 text-gray-700">${p.current_price?.toFixed(2)}</td>
                    <td className="p-3 hidden lg:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.status === 'published' ? 'bg-green-50 text-green-700' :
                        p.status === 'draft' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{p.status}</span>
                    </td>
                    <td className="p-3 text-gray-500 hidden lg:table-cell">{p.click_count}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/product/${p.slug}`} target="_blank" className="text-xs text-gray-400 hover:text-accent">View</Link>
                        <Link href={`/admin/products/${p.id}`} className="text-xs text-gray-400 hover:text-accent">Edit</Link>
                        <button onClick={() => handleDelete(p.id, p.name)} className="text-xs text-gray-400 hover:text-red-500">Archive</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">Page {page} of {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-30">Previous</button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

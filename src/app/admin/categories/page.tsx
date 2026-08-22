'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect, useCallback } from 'react';
import slugify from 'slugify';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  parent_id: string | null;
  parent_name: string | null;
  sort_order: number;
  is_featured: number;
  product_count: number;
  children?: Category[];
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');

  const fetchCategories = useCallback(async () => {
    const res = await adminFetch('/api/categories?flat=true');
    const data = await res.json();
    setCategories(data.categories || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSave = async () => {
    if (!editing?.name?.trim()) { showToast('Name is required'); return; }
    const slug = editing.slug || slugify(editing.name, { lower: true, strict: true });
    const method = editing.id ? 'PUT' : 'POST';
    const url = editing.id ? `/api/categories/${editing.id}` : '/api/categories';
    const res = await adminFetch(url, {
      method,
      body: JSON.stringify({ ...editing, slug, sort_order: editing.sort_order ?? 0 }),
    });
    if (res.ok) {
      showToast(editing.id ? 'Category updated' : 'Category created');
      setEditing(null);
      fetchCategories();
    } else {
      const d = await res.json();
      showToast(d.error || 'Save failed');
    }
  };

  const handleDeleteCheck = (cat: Category) => {
    setDeleteConfirm(cat);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    await adminFetch(`/api/categories/${deleteConfirm.id}`, { method: 'DELETE' });
    showToast('Category deleted');
    setDeleteConfirm(null);
    fetchCategories();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await adminFetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const d = await res.json();
      setEditing((ed: any) => ({ ...ed, image: d.url }));
      showToast('Image uploaded');
    } else {
      showToast('Upload failed');
    }
  };

  const handleMoveOrder = async (cat: Category, direction: 'up' | 'down') => {
    const siblings = categories.filter(c => c.parent_id === cat.parent_id);
    const idx = siblings.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const swapCat = siblings[swapIdx];
    // Swap sort_order values
    await Promise.all([
      adminFetch(`/api/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...cat, sort_order: swapCat.sort_order }),
      }),
      adminFetch(`/api/categories/${swapCat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...swapCat, sort_order: cat.sort_order }),
      }),
    ]);
    fetchCategories();
  };

  const parents = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
  const childCount = (parentId: string) => categories.filter(c => c.parent_id === parentId).length;

  // Build tree view
  const treeData = parents.sort((a, b) => a.sort_order - b.sort_order).map(p => ({
    ...p,
    children: getChildren(p.id),
  }));

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Categories</h1>
          <p className="text-xs text-gray-400 mt-1">{parents.length} main categories · {categories.length - parents.length} subcategories</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs">
            <button onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 ${viewMode === 'tree' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              Tree
            </button>
            <button onClick={() => setViewMode('flat')}
              className={`px-3 py-1.5 ${viewMode === 'flat' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              Flat
            </button>
          </div>
          <button
            onClick={() => setEditing({ name: '', slug: '', description: '', image: '', parent_id: '', is_featured: false, sort_order: 0 })}
            className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-light transition-colors"
          >
            Add Category
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Delete &ldquo;{deleteConfirm.name}&rdquo;?</h3>
            {childCount(deleteConfirm.id) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                <p className="text-xs text-amber-700 font-medium">⚠ This category has {childCount(deleteConfirm.id)} subcategor{childCount(deleteConfirm.id) === 1 ? 'y' : 'ies'}.</p>
                <p className="text-xs text-amber-600 mt-1">Subcategories will be moved to top level.</p>
              </div>
            )}
            {(deleteConfirm.product_count || 0) > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                <p className="text-xs text-red-700 font-medium">⚠ This category has {deleteConfirm.product_count} product{deleteConfirm.product_count === 1 ? '' : 's'}.</p>
                <p className="text-xs text-red-600 mt-1">Products will become uncategorized.</p>
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleDeleteConfirmed} className="px-4 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg my-8">
            <h2 className="text-lg font-semibold mb-4">{editing.id ? 'Edit' : 'New'} Category</h2>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent"
                  placeholder="e.g. Dresses"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Slug</label>
                <input
                  type="text"
                  value={editing.slug || slugify(editing.name || '', { lower: true, strict: true })}
                  onChange={e => setEditing({ ...editing, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-500 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <textarea
                  rows={2}
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent"
                  placeholder="Short editorial description (e.g. 'Everyday styles worth discovering.')"
                />
              </div>

              {/* Image */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Image</label>
                {editing.image ? (
                  <div className="mb-3">
                    <div className="relative inline-block">
                      <img src={editing.image} alt={editing.name || 'Category'} className="w-full max-w-xs h-40 object-cover rounded-lg border border-gray-200" />
                      <button onClick={() => setEditing({ ...editing, image: '' })}
                        className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 text-xs shadow">✕</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center mb-3">
                    <p className="text-xs text-gray-400 mb-2">No image configured</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="px-3 py-1.5 border border-gray-200 rounded-md text-xs text-gray-600 cursor-pointer hover:border-accent transition-colors">
                    Upload Image
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  <input type="text" value={editing.image || ''} onChange={e => setEditing({ ...editing, image: e.target.value })}
                    placeholder="Or paste image URL" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:border-accent" />
                </div>
              </div>

              {/* Parent */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Parent Category</label>
                <select
                  value={editing.parent_id || ''}
                  onChange={e => setEditing({ ...editing, parent_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-accent"
                >
                  <option value="">None (main category)</option>
                  {parents.filter(p => p.id !== editing.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Sort Order</label>
                <input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent"
                />
              </div>

              {/* Featured */}
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={editing.is_featured || false}
                  onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} />
                Featured on homepage
              </label>

              {/* SEO */}
              <details className="border border-gray-100 rounded-md">
                <summary className="px-3 py-2 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">SEO Settings</summary>
                <div className="p-3 space-y-3 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">SEO Title</label>
                    <input type="text" value={editing.seo_title || ''} onChange={e => setEditing({ ...editing, seo_title: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:border-accent" placeholder="Custom page title" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">SEO Description</label>
                    <textarea rows={2} value={editing.seo_description || ''} onChange={e => setEditing({ ...editing, seo_description: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:border-accent" placeholder="Custom meta description" />
                  </div>
                </div>
              </details>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-light transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Category list */}
      {viewMode === 'tree' ? (
        /* Tree view */
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : treeData.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No categories yet</div>
          ) : (
            treeData.map(parent => (
              <div key={parent.id} className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                {/* Parent row */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-50">
                  <div className="w-12 h-10 flex-shrink-0 rounded-md overflow-hidden bg-gray-50">
                    {parent.image ? (
                      <img src={parent.image} alt={parent.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">—</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">{parent.name}</h3>
                      {parent.is_featured ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent/5 text-accent rounded">Featured</span>
                      ) : null}
                    </div>
                    {parent.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{parent.description}</p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-0.5">{parent.children.length} subcategor{parent.children.length === 1 ? 'y' : 'ies'} · /category/{parent.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleMoveOrder(parent, 'up')} title="Move up" className="p-1.5 text-gray-300 hover:text-gray-500 text-xs">↑</button>
                    <button onClick={() => handleMoveOrder(parent, 'down')} title="Move down" className="p-1.5 text-gray-300 hover:text-gray-500 text-xs">↓</button>
                    <button onClick={() => setEditing(parent)} className="px-2.5 py-1 text-xs text-gray-400 hover:text-accent border border-gray-100 rounded hover:border-accent/30 transition-colors">Edit</button>
                    <button onClick={() => setEditing({ name: '', slug: '', description: '', image: '', parent_id: parent.id, is_featured: false, sort_order: parent.children.length })}
                      className="px-2.5 py-1 text-xs text-accent bg-accent/5 rounded hover:bg-accent/10 transition-colors">+ Sub</button>
                    <button onClick={() => handleDeleteCheck(parent)} className="px-2.5 py-1 text-xs text-gray-300 hover:text-red-500 transition-colors">Delete</button>
                  </div>
                </div>

                {/* Children */}
                {parent.children.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {parent.children.map((child, ci) => (
                      <div key={child.id} className="flex items-center gap-3 px-4 py-3 pl-10 hover:bg-gray-50/50">
                        <div className="w-9 h-7 flex-shrink-0 rounded overflow-hidden bg-gray-50">
                          {child.image ? (
                            <img src={child.image} alt={child.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-200 text-[9px]">—</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700">{child.name}</p>
                          {child.description && <p className="text-[11px] text-gray-400 mt-0.5">{child.description}</p>}
                        </div>
                        <span className="text-[10px] text-gray-300">#{ci + 1}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleMoveOrder(child, 'up')} title="Move up" className="p-1 text-gray-300 hover:text-gray-500 text-xs">↑</button>
                          <button onClick={() => handleMoveOrder(child, 'down')} title="Move down" className="p-1 text-gray-300 hover:text-gray-500 text-xs">↓</button>
                          <button onClick={() => setEditing(child)} className="text-xs text-gray-400 hover:text-accent px-2 py-0.5">Edit</button>
                          <button onClick={() => handleDeleteCheck(child)} className="text-xs text-gray-300 hover:text-red-500 px-2 py-0.5">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Flat table view */
        <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-3 text-left text-xs font-medium text-gray-500">Image</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Parent</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Order</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Featured</th>
                <th className="p-3 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading...</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No categories</td></tr>
              ) : (
                categories.sort((a, b) => a.sort_order - b.sort_order).map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-2 w-14">
                      {c.image ? (
                        <img src={c.image} alt={c.name} className="w-10 h-8 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-300 text-[10px]">—</div>
                      )}
                    </td>
                    <td className="p-3 font-medium text-gray-800">
                      {c.parent_id && <span className="text-gray-300 mr-2">└</span>}
                      {c.name}
                      {c.description && <p className="text-[11px] text-gray-400 font-normal mt-0.5 line-clamp-1">{c.description}</p>}
                    </td>
                    <td className="p-3 text-gray-500 hidden sm:table-cell text-xs">{c.parent_name || '—'}</td>
                    <td className="p-3 text-gray-400 hidden md:table-cell text-xs">{c.sort_order}</td>
                    <td className="p-3 hidden md:table-cell">{c.is_featured ? <span className="text-xs text-accent">✓</span> : ''}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => setEditing(c)} className="text-xs text-gray-400 hover:text-accent mr-3">Edit</button>
                      <button onClick={() => handleDeleteCheck(c)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

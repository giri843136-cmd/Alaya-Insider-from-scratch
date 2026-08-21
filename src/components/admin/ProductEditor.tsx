'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import slugify from 'slugify';

interface Props {
  productId?: string;
}

const defaultProduct = {
  name: '', slug: '', brand_id: '', category_id: '', subcategory_id: '', sku: '',
  current_price: 0, previous_price: '', currency: 'USD', rating: 0, review_count: 0,
  primary_image: '', image_alt: '', short_description: '', full_description: '',
  why_we_recommend: '', best_for: '', benefits: [] as string[], pros: [] as string[], cons: [] as string[],
  buying_advice: '', tags: [] as string[], status: 'draft',
  is_featured: false, is_trending: false, is_editors_pick: false,
  affiliate_url: '', marketplace: '', affiliate_network: '', tracking_id: '', cta_text: 'Check Price',
  global_affiliate_url: '', global_affiliate_network: '', global_tracking_id: '', global_cta_label: 'Explore Global Options', global_active: true,
  india_affiliate_url: '', india_affiliate_network: '', india_tracking_id: '', india_cta_label: 'Explore India', india_active: true,
  seo_title: '', seo_description: '', canonical_url: '', focus_keyword: '',
};

export default function ProductEditor({ productId }: Props) {
  const [form, setForm] = useState(defaultProduct);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const router = useRouter();

  useEffect(() => {
    adminFetch('/api/categories?flat=true').then(r => r.json()).then(d => setCategories(d.categories || []));
    adminFetch('/api/brands').then(r => r.json()).then(d => setBrands(d.brands || []));

    if (productId) {
      adminFetch(`/api/products/${productId}`)
        .then(r => r.json())
        .then(d => {
          if (d.product) {
            const p = d.product;
            setForm({
              name: p.name || '', slug: p.slug || '',
              brand_id: p.brand_id || '', category_id: p.category_id || '',
              subcategory_id: p.subcategory_id || '', sku: p.sku || '',
              current_price: p.current_price || 0, previous_price: p.previous_price || '',
              currency: p.currency || 'USD', rating: p.rating || 0, review_count: p.review_count || 0,
              primary_image: p.primary_image || '', image_alt: p.image_alt || '',
              short_description: p.short_description || '', full_description: p.full_description || '',
              why_we_recommend: p.why_we_recommend || '', best_for: p.best_for || '',
              benefits: p.benefits || [], pros: p.pros || [], cons: p.cons || [],
              buying_advice: p.buying_advice || '', tags: p.tags || [],
              status: p.status || 'draft', is_featured: !!p.is_featured,
              is_trending: !!p.is_trending, is_editors_pick: !!p.is_editors_pick,
              affiliate_url: p.affiliate_url || '', marketplace: p.marketplace || '',
              global_affiliate_url: p.global_affiliate_url || '', global_affiliate_network: p.global_affiliate_network || '',
              global_tracking_id: p.global_tracking_id || '', global_cta_label: p.global_cta_label || 'Explore Global Options', global_active: !!p.global_active,
              india_affiliate_url: p.india_affiliate_url || '', india_affiliate_network: p.india_affiliate_network || '',
              india_tracking_id: p.india_tracking_id || '', india_cta_label: p.india_cta_label || 'Explore India', india_active: !!p.india_active,
              affiliate_network: p.affiliate_network || '', tracking_id: p.tracking_id || '',
              cta_text: p.cta_text || 'Check Price',
              seo_title: p.seo_title || '', seo_description: p.seo_description || '',
              canonical_url: p.canonical_url || '', focus_keyword: p.focus_keyword || '',
            });
          }
          setLoading(false);
        });
    }
  }, [productId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSave = async () => {
    if (!form.name) { showToast('Product name is required'); return; }
    setSaving(true);

    const slug = form.slug || slugify(form.name, { lower: true, strict: true });
    const body = { ...form, slug, previous_price: form.previous_price || null };

    try {
      const url = productId ? `/api/products/${productId}` : '/api/products';
      const method = productId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();

      if (res.ok) {
        showToast(productId ? 'Product saved' : 'Product created');
        if (!productId && data.id) {
          router.push(`/admin/products/${data.id}`);
        }
      } else {
        showToast(data.error || 'Save failed');
      }
    } catch {
      showToast('Save failed');
    }
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await adminFetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setForm(f => ({ ...f, primary_image: data.url }));
        showToast('Image uploaded');
      } else {
        showToast(data.error || 'Upload failed');
      }
    } catch {
      showToast('Upload failed');
    }
  };

  const updateList = (field: 'benefits' | 'pros' | 'cons' | 'tags', index: number, value: string) => {
    setForm(f => ({ ...f, [field]: f[field].map((item: string, i: number) => i === index ? value : item) }));
  };
  const addToList = (field: 'benefits' | 'pros' | 'cons' | 'tags') => {
    setForm(f => ({ ...f, [field]: [...f[field], ''] }));
  };
  const removeFromList = (field: 'benefits' | 'pros' | 'cons' | 'tags', index: number) => {
    setForm(f => ({ ...f, [field]: f[field].filter((_: string, i: number) => i !== index) }));
  };

  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'editorial', label: 'Editorial' },
    { id: 'affiliate', label: 'Affiliate' },
    { id: 'seo', label: 'SEO' },
    { id: 'media', label: 'Media' },
  ];

  if (loading) return <div className="text-gray-400 text-sm">Loading product...</div>;

  // Publish checklist
  const missingFields: string[] = [];
  if (!form.name) missingFields.push('Product name');
  if (!form.short_description) missingFields.push('Description');
  if (!form.category_id) missingFields.push('Category');
  if (!form.seo_title) missingFields.push('SEO title');
  if (!form.seo_description) missingFields.push('Meta description');

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-xl font-semibold text-gray-800">
          {productId ? 'Edit Product' : 'New Product'}
        </h1>
        <div className="flex gap-2">
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-light transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Publish checklist */}
      {missingFields.length > 0 && form.status === 'published' && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
          <p className="text-sm text-amber-800 font-medium">Missing recommended fields:</p>
          <p className="text-sm text-amber-600 mt-1">{missingFields.join(', ')}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id ? 'border-accent text-accent font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-lg p-6">
        {/* Basic */}
        {activeTab === 'basic' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Product Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || '' }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Slug</label>
              <input type="text" value={form.slug || slugify(form.name || '', { lower: true, strict: true })}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Brand</label>
                <select value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                  <option value="">Select brand</option>
                  {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                  <option value="">Select category</option>
                  {categories.filter((c: any) => !c.parent_id).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Subcategory</label>
              <select value={form.subcategory_id} onChange={e => setForm(f => ({ ...f, subcategory_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="">Select subcategory</option>
                {categories.filter((c: any) => c.parent_id === form.category_id).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Price</label>
                <input type="number" step="0.01" value={form.current_price}
                  onChange={e => setForm(f => ({ ...f, current_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Previous Price</label>
                <input type="number" step="0.01" value={form.previous_price}
                  onChange={e => setForm(f => ({ ...f, previous_price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">SKU</label>
                <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Rating</label>
                <input type="number" step="0.1" min="0" max="5" value={form.rating}
                  onChange={e => setForm(f => ({ ...f, rating: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Review Count</label>
                <input type="number" value={form.review_count}
                  onChange={e => setForm(f => ({ ...f, review_count: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_trending} onChange={e => setForm(f => ({ ...f, is_trending: e.target.checked }))} />
                Trending
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_editors_pick} onChange={e => setForm(f => ({ ...f, is_editors_pick: e.target.checked }))} />
                Editor&apos;s Pick
              </label>
            </div>
          </div>
        )}

        {/* Editorial */}
        {activeTab === 'editorial' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Short Description</label>
              <textarea rows={3} value={form.short_description}
                onChange={e => setForm(f => ({ ...f, short_description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Why We Recommend</label>
              <textarea rows={3} value={form.why_we_recommend}
                onChange={e => setForm(f => ({ ...f, why_we_recommend: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Best For</label>
              <input type="text" value={form.best_for} onChange={e => setForm(f => ({ ...f, best_for: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Key Benefits</label>
              {form.benefits.map((b: string, i: number) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" value={b} onChange={e => updateList('benefits', i, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm" />
                  <button onClick={() => removeFromList('benefits', i)} className="text-red-400 text-xs px-2">✕</button>
                </div>
              ))}
              <button onClick={() => addToList('benefits')} className="text-xs text-accent hover:underline">+ Add benefit</button>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Pros</label>
              {form.pros.map((p: string, i: number) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" value={p} onChange={e => updateList('pros', i, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm" />
                  <button onClick={() => removeFromList('pros', i)} className="text-red-400 text-xs px-2">✕</button>
                </div>
              ))}
              <button onClick={() => addToList('pros')} className="text-xs text-accent hover:underline">+ Add pro</button>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cons</label>
              {form.cons.map((c: string, i: number) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" value={c} onChange={e => updateList('cons', i, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm" />
                  <button onClick={() => removeFromList('cons', i)} className="text-red-400 text-xs px-2">✕</button>
                </div>
              ))}
              <button onClick={() => addToList('cons')} className="text-xs text-accent hover:underline">+ Add con</button>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Buying Advice</label>
              <textarea rows={3} value={form.buying_advice}
                onChange={e => setForm(f => ({ ...f, buying_advice: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Full Description (HTML)</label>
              <textarea rows={8} value={form.full_description}
                onChange={e => setForm(f => ({ ...f, full_description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono" />
            </div>
          </div>
        )}

        {/* Affiliate */}
        {activeTab === 'affiliate' && (
          <div className="space-y-6 max-w-2xl">
            {/* Global Destination */}
            <div className="border border-gray-100 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">🌍 Global Shopping</h3>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.global_active !== false} onChange={e => setForm(f => ({ ...f, global_active: e.target.checked }))} /> Active
                </label>
              </div>
              <div className="space-y-3">
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Global Affiliate URL</label>
                  <input type="url" value={form.global_affiliate_url || ''} onChange={e => setForm(f => ({ ...f, global_affiliate_url: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">Network</label>
                    <input type="text" value={form.global_affiliate_network || ''} onChange={e => setForm(f => ({ ...f, global_affiliate_network: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="Amazon Associates" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">Tracking ID</label>
                    <input type="text" value={form.global_tracking_id || ''} onChange={e => setForm(f => ({ ...f, global_tracking_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                </div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">CTA Label</label>
                  <input type="text" value={form.global_cta_label || ''} onChange={e => setForm(f => ({ ...f, global_cta_label: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="Explore Global Options" /></div>
              </div>
            </div>

            {/* India Destination */}
            <div className="border border-gray-100 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">🇮🇳 India Shopping</h3>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.india_active !== false} onChange={e => setForm(f => ({ ...f, india_active: e.target.checked }))} /> Active
                </label>
              </div>
              <div className="space-y-3">
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">India Affiliate URL</label>
                  <input type="url" value={form.india_affiliate_url || ''} onChange={e => setForm(f => ({ ...f, india_affiliate_url: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">Network</label>
                    <input type="text" value={form.india_affiliate_network || ''} onChange={e => setForm(f => ({ ...f, india_affiliate_network: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="Amazon Associates" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">Tracking ID</label>
                    <input type="text" value={form.india_tracking_id || ''} onChange={e => setForm(f => ({ ...f, india_tracking_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                </div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">CTA Label</label>
                  <input type="text" value={form.india_cta_label || ''} onChange={e => setForm(f => ({ ...f, india_cta_label: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="Explore India" /></div>
              </div>
            </div>
          </div>
        )}

        {/* SEO */}
        {activeTab === 'seo' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">SEO Title</label>
              <input type="text" value={form.seo_title}
                onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <p className="text-xs text-gray-400 mt-1">{form.seo_title.length}/60 characters</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Meta Description</label>
              <textarea rows={2} value={form.seo_description}
                onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <p className="text-xs text-gray-400 mt-1">{form.seo_description.length}/160 characters</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Canonical URL</label>
              <input type="text" value={form.canonical_url}
                onChange={e => setForm(f => ({ ...f, canonical_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Focus Keyword</label>
              <input type="text" value={form.focus_keyword}
                onChange={e => setForm(f => ({ ...f, focus_keyword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
          </div>
        )}

        {/* Media */}
        {activeTab === 'media' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Primary Image</label>
              {form.primary_image && (
                <div className="mb-3">
                  <img src={form.primary_image} alt="" className="w-40 h-40 object-cover rounded-lg border" />
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload}
                className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:border file:border-gray-200 file:rounded-md file:text-sm file:bg-white file:text-gray-600 hover:file:border-accent" />
              <div className="mt-2">
                <label className="text-xs text-gray-500 mb-1 block">Or paste image URL</label>
                <input type="url" value={form.primary_image}
                  onChange={e => setForm(f => ({ ...f, primary_image: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Image Alt Text</label>
              <input type="text" value={form.image_alt}
                onChange={e => setForm(f => ({ ...f, image_alt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

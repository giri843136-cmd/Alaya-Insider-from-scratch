'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminHero() {
  const [slides, setSlides] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const fetchData = async () => {
    const res = await adminFetch('/api/hero-slides?admin=true');
    const data = await res.json();
    setSlides(data.slides || []);
    setSettings(data.settings || {});
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSaveSlide = async () => {
    if (!editing) return;
    const method = editing.id && slides.find(s => s.id === editing.id) ? 'PUT' : 'POST';
    const res = await adminFetch('/api/hero-slides', { method, body: JSON.stringify(editing) });
    if (res.ok) { showToast('Slide saved'); setEditing(null); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this slide?')) return;
    await adminFetch('/api/hero-slides', { method: 'DELETE', body: JSON.stringify({ id }) });
    showToast('Slide deleted');
    fetchData();
  };

  const handleSaveSettings = async () => {
    await adminFetch('/api/hero-slides', { method: 'PUT', body: JSON.stringify({ settings }) });
    showToast('Settings saved');
  };

  const handleDuplicate = (slide: any) => {
    const { id, created_at, updated_at, ...rest } = slide;
    setEditing({ ...rest, headline: rest.headline + ' (Copy)', status: 'draft' });
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>;

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Hero Carousel</h1>
          <p className="text-sm text-gray-400">{slides.length} slides</p>
        </div>
        <button onClick={() => setEditing({ eyebrow: '', headline: '', description: '', primary_cta_label: '', primary_cta_url: '', secondary_cta_label: '', secondary_cta_url: '', desktop_image: '', background_color: '#f8f6f3', text_color: 'dark', layout: 'text-left', status: 'draft', sort_order: slides.length })}
          className="px-4 py-2 bg-accent text-white text-sm rounded-md">Add Slide</button>
      </div>

      {/* Carousel Settings */}
      <div className="bg-white border border-gray-100 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Carousel Settings</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Autoplay</label>
            <select value={settings.autoplay || 'true'} onChange={e => setSettings(s => ({ ...s, autoplay: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white">
              <option value="true">On</option><option value="false">Off</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Interval (ms)</label>
            <select value={settings.interval || '5000'} onChange={e => setSettings(s => ({ ...s, interval: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white">
              {[3000,4000,5000,6000,7000,8000,10000].map(v => <option key={v} value={v}>{v/1000}s</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Transition</label>
            <select value={settings.transition || 'fade'} onChange={e => setSettings(s => ({ ...s, transition: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white">
              <option value="fade">Fade</option><option value="slide">Slide</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleSaveSettings} className="px-4 py-1.5 bg-accent text-white text-sm rounded-md">Save Settings</button>
          </div>
        </div>
      </div>

      {/* Slide Editor Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mb-10">
            <h2 className="text-lg font-semibold mb-4">{editing.id ? 'Edit' : 'New'} Slide</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Eyebrow</label>
                  <input type="text" value={editing.eyebrow||''} onChange={e => setEditing({...editing, eyebrow: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="CURATED THIS SEASON" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Status</label>
                  <select value={editing.status||'draft'} onChange={e => setEditing({...editing, status: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                    <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
                  </select></div>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Headline</label>
                <input type="text" value={editing.headline||''} onChange={e => setEditing({...editing, headline: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea rows={2} value={editing.description||''} onChange={e => setEditing({...editing, description: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Primary CTA Label</label>
                  <input type="text" value={editing.primary_cta_label||''} onChange={e => setEditing({...editing, primary_cta_label: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Primary CTA URL</label>
                  <input type="text" value={editing.primary_cta_url||''} onChange={e => setEditing({...editing, primary_cta_url: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Secondary CTA Label</label>
                  <input type="text" value={editing.secondary_cta_label||''} onChange={e => setEditing({...editing, secondary_cta_label: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Secondary CTA URL</label>
                  <input type="text" value={editing.secondary_cta_url||''} onChange={e => setEditing({...editing, secondary_cta_url: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Desktop Image URL</label>
                <input type="text" value={editing.desktop_image||''} onChange={e => setEditing({...editing, desktop_image: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Background Color</label>
                  <input type="text" value={editing.background_color||'#f8f6f3'} onChange={e => setEditing({...editing, background_color: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Text Color</label>
                  <select value={editing.text_color||'dark'} onChange={e => setEditing({...editing, text_color: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                    <option value="dark">Dark</option><option value="light">Light</option>
                  </select></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Layout</label>
                  <select value={editing.layout||'text-left'} onChange={e => setEditing({...editing, layout: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                    <option value="text-left">Text Left</option><option value="text-right">Text Right</option><option value="text-center">Text Center</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                  <input type="date" value={editing.start_date||''} onChange={e => setEditing({...editing, start_date: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">End Date</label>
                  <input type="date" value={editing.end_date||''} onChange={e => setEditing({...editing, end_date: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Sort Order</label>
                <input type="number" value={editing.sort_order||0} onChange={e => setEditing({...editing, sort_order: parseInt(e.target.value)||0})} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm max-w-[100px]" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={handleSaveSlide} className="px-5 py-2 bg-accent text-white text-sm rounded-md">Save Slide</button>
            </div>
          </div>
        </div>
      )}

      {/* Slides List */}
      <div className="space-y-3">
        {slides.map((s, i) => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-lg p-4 flex items-center gap-4">
            <span className="text-xs text-gray-400 w-6 text-center">{i + 1}</span>
            <div className="w-16 h-10 rounded flex-shrink-0 border border-gray-100" style={{ backgroundColor: s.background_color || '#f8f6f3' }}>
              {s.desktop_image && <img src={s.desktop_image} alt="" className="w-full h-full object-cover rounded" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{s.headline || '(No headline)'}</p>
              <p className="text-xs text-gray-400 truncate">{s.eyebrow} · {s.primary_cta_label}</p>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
            <div className="flex gap-2">
              <button onClick={() => setEditing({...s})} className="text-xs text-gray-400 hover:text-accent">Edit</button>
              <button onClick={() => handleDuplicate(s)} className="text-xs text-gray-400 hover:text-accent">Duplicate</button>
              <button onClick={() => handleDelete(s.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
            </div>
          </div>
        ))}
        {slides.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No slides yet. Add your first slide above.</p>}
      </div>
    </div>
  );
}

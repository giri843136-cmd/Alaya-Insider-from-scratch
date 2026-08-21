'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminHomepage() {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminFetch('/api/homepage').then(r => r.json()).then(d => { setSections(d.sections || []); setLoading(false); });
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const updateSection = (index: number, updates: any) => {
    setSections(s => s.map((sec, i) => i === index ? { ...sec, ...updates } : sec));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await adminFetch('/api/homepage', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sections }),
    });
    if (res.ok) showToast('Homepage saved');
    else showToast('Save failed');
    setSaving(false);
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Homepage Sections</h1>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={s.is_visible === 1}
                    onChange={e => updateSection(i, { is_visible: e.target.checked ? 1 : 0 })} />
                </label>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{s.section_key}</span>
              </div>
              <span className="text-xs text-gray-400">Order: {s.sort_order}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Title</label>
                <input type="text" value={s.title} onChange={e => updateSection(i, { title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              {s.content?.subtitle !== undefined && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subtitle</label>
                  <input type="text" value={s.content?.subtitle || ''} onChange={e => updateSection(i, { content: { ...s.content, subtitle: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
                </div>
              )}
              {s.content?.primary_cta !== undefined && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Primary CTA</label>
                    <input type="text" value={s.content?.primary_cta || ''} onChange={e => updateSection(i, { content: { ...s.content, primary_cta: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Primary CTA Link</label>
                    <input type="text" value={s.content?.primary_cta_link || ''} onChange={e => updateSection(i, { content: { ...s.content, primary_cta_link: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
                  </div>
                </>
              )}
              {s.content?.cta_text !== undefined && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">CTA Text</label>
                  <input type="text" value={s.content?.cta_text || ''} onChange={e => updateSection(i, { content: { ...s.content, cta_text: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

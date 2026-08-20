'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminFetch('/api/settings').then(r => r.json()).then(d => { setSettings(d.settings || {}); setLoading(false); });
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSave = async () => {
    setSaving(true);
    const res = await adminFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
    if (res.ok) showToast('Settings saved');
    else showToast('Save failed');
    setSaving(false);
  };

  const update = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  if (loading) return <div className="text-gray-400 text-sm">Loading settings...</div>;

  const groups = [
    { title: 'General', fields: [
      { key: 'site_name', label: 'Site Name' },
      { key: 'site_tagline', label: 'Tagline' },
      { key: 'site_description', label: 'Description' },
      { key: 'site_url', label: 'Site URL' },
      { key: 'contact_email', label: 'Contact Email' },
      { key: 'default_currency', label: 'Default Currency' },
    ]},
    { title: 'Affiliate Disclosure', fields: [
      { key: 'affiliate_disclosure', label: 'Disclosure Text', textarea: true },
    ]},
    { title: 'Shopping Destinations', desc: 'Configure the destination labels shown on product pages.', fields: [
      { key: 'dest_section_heading', label: 'Section Heading' },
      { key: 'dest_section_desc', label: 'Section Description' },
      { key: 'dest_global_heading', label: 'Global — Heading' },
      { key: 'dest_global_desc', label: 'Global — Description' },
      { key: 'dest_global_cta', label: 'Global — CTA Button Text' },
      { key: 'dest_india_heading', label: 'India — Heading' },
      { key: 'dest_india_desc', label: 'India — Description' },
      { key: 'dest_india_cta', label: 'India — CTA Button Text' },
      { key: 'dest_disclaimer', label: 'Disclaimer Text' },
    ]},
    { title: 'Social Links', fields: [
      { key: 'social_twitter', label: 'Twitter / X' },
      { key: 'social_instagram', label: 'Instagram' },
      { key: 'social_pinterest', label: 'Pinterest' },
      { key: 'social_youtube', label: 'YouTube' },
    ]},
    { title: 'Analytics', fields: [
      { key: 'analytics_id', label: 'Google Analytics ID (G-XXXXXXXXXX)' },
    ]},
  ];

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Settings</h1>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="space-y-6">
        {groups.map(g => (
          <div key={g.title} className="bg-white border border-gray-100 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">{g.title}</h2>
            {(g as any).desc && <p className="text-xs text-gray-400 mb-4">{(g as any).desc}</p>}
            <div className="space-y-4 max-w-lg mt-3">
              {g.fields.map((f: any) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                  {f.textarea ? (
                    <textarea rows={3} value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
                  ) : (
                    <input type="text" value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

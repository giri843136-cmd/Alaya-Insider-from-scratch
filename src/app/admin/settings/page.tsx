'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

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

  const handle2FASetup = async () => {
    setTwoFaLoading(true);
    try {
      const res = await adminFetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (data.uri) {
        setTwoFaSetup(data);
      } else {
        showToast(data.error || 'Failed to start 2FA setup');
      }
    } catch (err) {
      showToast('Error connecting to server');
    }
    setTwoFaLoading(false);
  };

  const handle2FAVerify = async () => {
    setTwoFaLoading(true);
    const res = await adminFetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: twoFaCode }),
    });
    const data = await res.json();
    if (data.success) {
      setTwoFaEnabled(true);
      setTwoFaSetup(null);
      showToast('2FA enabled!');
    } else {
      showToast(data.error || 'Invalid code');
    }
    setTwoFaLoading(false);
  };

  const handle2FADisable = async () => {
    if (!confirm('Disable 2FA? This makes your account less secure.')) return;
    setTwoFaLoading(true);
    const res = await adminFetch('/api/auth/2fa/disable', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setTwoFaEnabled(false);
      showToast('2FA disabled');
    }
    setTwoFaLoading(false);
  };

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
      {/* 2FA Security Section */}
      <div className="bg-white border border-gray-100 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Two-Factor Authentication (2FA)</h2>
        <p className="text-xs text-gray-400 mb-4">Add an extra layer of security to your admin account using an authenticator app.</p>
        <div className="space-y-3">
          {!twoFaEnabled && !twoFaSetup && (
            <button onClick={handle2FASetup} disabled={twoFaLoading}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md disabled:opacity-50">
              {twoFaLoading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          )}
          {twoFaSetup && (
            <div className="border border-dashed border-green-300 rounded-lg p-4 bg-green-50">
              <p className="text-sm font-medium text-green-800 mb-2">Scan this QR code with your authenticator app:</p>
              <div className="bg-white p-3 rounded-lg inline-block mb-3 border">
                <img src={twoFaSetup.qr} alt="2FA QR Code" className="w-[200px] h-[200px]" />
              </div>
              <p className="text-xs text-gray-600 mb-1">Can't scan? Enter this key manually: <code className="bg-white px-2 py-0.5 rounded border text-xs">{twoFaSetup.secret}</code></p>
              <div className="flex items-center gap-2 mt-3">
                <input type="text" placeholder="Enter 6-digit code" value={twoFaCode} onChange={e => setTwoFaCode(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm w-40" />
                <button onClick={handle2FAVerify} disabled={twoFaLoading || twoFaCode.length < 6}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md disabled:opacity-50">
                  Verify & Enable
                </button>
              </div>
            </div>
          )}
          {twoFaEnabled && !twoFaSetup && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-600 font-medium">2FA is enabled ✓</span>
              <button onClick={handle2FADisable} disabled={twoFaLoading}
                className="px-3 py-1.5 text-red-600 text-xs border border-red-200 rounded-md hover:bg-red-50">
                Disable 2FA
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Site Settings */}
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

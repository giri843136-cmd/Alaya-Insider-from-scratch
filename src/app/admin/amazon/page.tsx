'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-auth-context';

interface Diagnostics {
  configured: boolean;
  source: 'db' | 'env' | null;
  clientId: string;
  version: string;
  partnerTag: string;
  marketplace: string;
  tokenEndpoint: string;
  secretStored: boolean;
  lastError: { code: string; message: string; httpStatus?: number | null } | null;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
  lastTest: any;
  lastCronRun: string | null;
  lastCronSummary: any;
}

interface TestResult {
  testedAt: string;
  asins: string[];
  httpStatus: number | null;
  errors: { code: string; message: string }[];
  items: any[];
}

const DEFAULT_DIAG: Diagnostics = {
  configured: false, source: null, clientId: '', version: '3.2', partnerTag: 'alayainsider-21',
  marketplace: 'www.amazon.in', tokenEndpoint: '', secretStored: false,
  lastError: null, lastErrorAt: null, lastSuccessAt: null, lastTest: null, lastCronRun: null, lastCronSummary: null,
};

const VERIFICATION_LABELS = ['Clothing / fashion item', 'Handbag', 'Watch'];

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }); } catch { return iso; }
}

function friendlyVerdict(t: TestResult | null): { tone: 'ok' | 'warn' | 'err'; text: string } {
  if (!t) return { tone: 'warn', text: '' };
  const err = t.errors?.[0];
  if (err?.code === 'NO_CREDENTIALS') {
    return { tone: 'warn', text: 'No credentials configured yet — save your Credential ID / Secret / Version / Partner Tag above, then re-test.' };
  }
  const oauthish = /invalid_client|InvalidCredentials|Unauthorized|not authorized|AuthenticationException/i.test(`${err?.code || ''} ${err?.message || ''}`);
  if (err && oauthish) {
    return { tone: 'ok', text: 'PLUMBING OK — Amazon rejected the credentials at the OAuth token endpoint (expected while dummy/incorrect keys are in place). This is the Creators-API equivalent of the old "InvalidClientTokenId" proof: the request pipeline works end-to-end. Enter real keys and this same test returns live prices.' };
  }
  if (t.items?.length > 0 && t.items.some((i: any) => i.priceAmount != null)) {
    return { tone: 'ok', text: 'SUCCESS — Amazon returned live item data with prices. Live boxes will populate now.' };
  }
  if (err) {
    return { tone: 'err', text: `Amazon replied HTTP ${t.httpStatus ?? '—'} with ${err.code}: ${err.message}. See RUNBOOK.md for troubleshooting.` };
  }
  return { tone: 'warn', text: 'No items returned for the tested ASINs (they may not be accessible on Amazon.in).' };
}

export default function AdminAmazon() {
  const [diag, setDiag] = useState<Diagnostics>(DEFAULT_DIAG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  // Form fields
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [version, setVersion] = useState('3.2');
  const [partnerTag, setPartnerTag] = useState('alayainsider-21');
  const [marketplace, setMarketplace] = useState('www.amazon.in');
  const [tokenEndpoint, setTokenEndpoint] = useState('');
  const [testAsins, setTestAsins] = useState<string[]>(['', '', '']);

  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/creators/settings');
      const data = await res.json();
      if (data.diagnostics) {
        const d: Diagnostics = { ...DEFAULT_DIAG, ...data.diagnostics };
        setDiag(d);
        if (d.clientId) setClientId(d.clientId);      // masked value; user only overwrites when replacing keys
        if (d.version) setVersion(d.version);
        if (d.partnerTag) setPartnerTag(d.partnerTag);
        if (d.marketplace) setMarketplace(d.marketplace);
        if (d.tokenEndpoint) setTokenEndpoint(d.tokenEndpoint);
        setTestResult(d.lastTest || null);
      }
    } catch {
      setError('Could not load status. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await adminFetch('/api/creators/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, clientSecret, version, partnerTag, marketplace, tokenEndpoint,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClientSecret(''); // never echo the secret back
        showToast('Credentials saved');
        await loadStatus();
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (e: any) {
      setError('Could not save: ' + (e?.message || e));
    } finally { setSaving(false); }
  };

  const handleClear = async () => {
    if (!confirm('Remove stored Creators API credentials? The site will fall back to text-link mode until new keys are saved.')) return;
    setError('');
    try {
      const res = await adminFetch('/api/creators/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClientId(''); setClientSecret(''); setClientSecret(''); setVersion('3.2');
        setPartnerTag('alayainsider-21'); setMarketplace('www.amazon.in'); setTokenEndpoint('');
        setTestResult(null);
        showToast('Credentials cleared — fallback text-link mode active');
        await loadStatus();
      } else setError(data.error || 'Clear failed');
    } catch (e: any) { setError('Could not clear: ' + (e?.message || e)); }
  };

  const handleTest = async (forceToken = true) => {
    const asins = testAsins.map(a => a.trim().toUpperCase()).filter(Boolean);
    if (asins.length === 0) { setError('Enter at least one 10-character amazon.in ASIN to test.'); return; }
    setTesting(true); setError('');
    try {
      const res = await adminFetch('/api/creators/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asins, force: forceToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Test failed'); setTestResult(null); }
      else { setTestResult(data); }
    } catch (e: any) {
      setError('Test request failed: ' + (e?.message || e));
    } finally { setTesting(false); }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true); setError('');
    try {
      const res = await adminFetch('/api/cron/amazon-prices', { method: 'POST' });
      const data = await res.json();
      if (res.ok) { showToast(data.message || 'Refresh complete'); await loadStatus(); }
      else setError(data.error || 'Refresh failed');
    } catch (e: any) { setError('Refresh request failed: ' + (e?.message || e)); }
    finally { setRefreshing(false); }
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading Amazon API status...</div>;

  const verdict = friendlyVerdict(testResult);
  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-md text-sm';

  return (
    <div className="max-w-4xl">
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Amazon API (India)</h1>
          <p className="text-xs text-gray-400 mt-1">Amazon Creators API · www.amazon.in — the official replacement for PA-API 5.0 (retired 15 May 2026)</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className={`px-3 py-1.5 rounded-full font-medium ${diag.configured ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
            {diag.configured ? 'Configured' : 'Not configured'}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Source: {diag.source || '—'}</span>
        </div>
      </div>

      {!diag.configured && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Before entering real keys</p>
          <p className="text-amber-700 text-xs leading-relaxed">
            Sign in to Amazon Associates (India store) → <strong>Tools → Creators API</strong> → Create Application → Create Credential.
            You need <strong>Credential ID</strong>, <strong>Credential Secret</strong> (shown once), and the <strong>Version</strong>
            (Amazon.in accounts use <strong>3.2</strong>). Then come back here and paste them below. Your existing Partner Tag
            (<code className="bg-white px-1 rounded">alayainsider-21</code>) stays the same. Until then the site shows the
            “Check price on Amazon” fallback — that is safe and compliant. Testing with dummy keys is expected to return an OAuth
            “invalid_client” error, which proves the plumbing.
          </p>
        </div>
      )}

      {/* Credentials */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Credentials</h2>
        <p className="text-xs text-gray-400 mb-4">Secret is encrypted at rest and never shown again after saving — leave the Secret field blank to keep the stored one.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Credential ID</label>
            <input className={inputCls} value={clientId} onChange={e => setClientId(e.target.value)}
              placeholder={diag.clientId ? `Stored: ${diag.clientId} (replace only if rotated)` : 'e.g. amzn1.application-oa2-client.…'} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Credential Secret</label>
            <input type="password" className={inputCls} value={clientSecret} onChange={e => setClientSecret(e.target.value)}
              autoComplete="new-password"
              placeholder={diag.secretStored ? '•••••••• (unchanged — blank keeps it)' : 'Paste secret (shown once at creation)'} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Credential Version</label>
            <select className={inputCls} value={version} onChange={e => setVersion(e.target.value)}>
              <option value="3.1">3.1 — North America (api.amazon.com)</option>
              <option value="3.2">3.2 — EU incl. India (api.amazon.co.uk)</option>
              <option value="3.3">3.3 — Far East (api.amazon.co.jp)</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">India accounts: 3.2</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Partner Tag</label>
            <input className={inputCls} value={partnerTag} onChange={e => setPartnerTag(e.target.value)}
              placeholder="alayainsider-21" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Marketplace</label>
            <input className={inputCls} value={marketplace} onChange={e => setMarketplace(e.target.value)}
              placeholder="www.amazon.in" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Token endpoint override (optional)</label>
            <input className={inputCls} value={tokenEndpoint} onChange={e => setTokenEndpoint(e.target.value)}
              placeholder="Auto from version — e.g. https://api.amazon.co.uk/auth/o2/token" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">{saving ? 'Saving...' : 'Save credentials'}</button>
          <button onClick={handleClear}
            className="px-4 py-2 text-red-600 text-sm border border-red-200 rounded-md hover:bg-red-50">Clear credentials</button>
        </div>
      </div>

      {/* Test */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Connection test (health check)</h2>
        <p className="text-xs text-gray-400 mb-4">
          Runs a real GetItems request to <code className="bg-gray-50 px-1 rounded">creatorsapi.amazon</code> with the stored credentials.
          Dummy keys ⇒ OAuth <em>invalid_client</em> error = plumbing OK. Real keys ⇒ live prices below.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          {VERIFICATION_LABELS.map((label, i) => (
            <div key={label}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{label} — amazon.in ASIN</label>
              <input className={inputCls} value={testAsins[i]} onChange={e => { const next = [...testAsins]; next[i] = e.target.value; setTestAsins(next); }}
                placeholder="e.g. B0XXXXXXXX (from the product page URL)" maxLength={10} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={() => handleTest(true)} disabled={testing}
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-md disabled:opacity-50">{testing ? 'Testing...' : 'Run connection test'}</button>
          {diag.lastSuccessAt && <span className="text-xs text-green-600">Last successful API call: {fmtTime(diag.lastSuccessAt)}</span>}
          {diag.lastErrorAt && <span className="text-xs text-red-500">Last error: {fmtTime(diag.lastErrorAt)}{diag.lastError ? ` — ${diag.lastError.code}: ${diag.lastError.message.slice(0, 120)}` : ''}</span>}
        </div>

        {testResult && (
          <div className="mt-5 border rounded-lg overflow-hidden">
            <div className={`px-4 py-3 text-sm ${verdict.tone === 'ok' ? 'bg-green-50 text-green-800' : verdict.tone === 'err' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
              <strong>{testResult.httpStatus != null ? `HTTP ${testResult.httpStatus}` : 'No HTTP response'} · </strong>{verdict.text}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 mb-3 font-mono">
                Tested {testResult.testedAt} — asins: {testResult.asins.join(', ')}
                {testResult.errors?.length > 0 && <> · Amazon error: <span className="text-red-500">{testResult.errors.map(e => `${e.code}: ${e.message}`).join(' | ')}</span></>}
              </p>
              {testResult.items?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {testResult.items.map((it: any) => (
                    <div key={it.asin} className="bg-white border border-gray-100 rounded-lg p-3 flex gap-3 items-start">
                      {it.imageUrl && <img src={it.imageUrl} alt={it.title || it.asin} className="w-16 h-16 object-contain bg-white" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 line-clamp-2">{it.title || it.asin}</p>
                        {it.brand && <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{it.brand}</p>}
                        {it.priceDisplay && <p className="text-sm font-semibold text-accent mt-1">{it.priceDisplay}</p>}
                        <p className={`text-[10px] mt-0.5 ${it.availabilityType === 'IN_STOCK' ? 'text-green-600' : 'text-gray-400'}`}>
                          {it.availabilityType === 'IN_STOCK' ? 'In stock' : it.availabilityType || 'Availability unknown'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No items returned. {testResult.errors?.length ? 'See the error above.' : 'The ASINs may not be accessible on Amazon.in — verify them on an open amazon.in product page.'}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hourly refresh */}
      <div className="bg-white border border-gray-100 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Hourly price refresh (cron)</h2>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Live prices are cached for 1 hour and refresh on page views automatically. For a guaranteed hourly refresh even with low
          traffic, point an external cron service at <code className="bg-gray-50 px-1 rounded">POST https://alayainsider.com/api/cron/amazon-prices</code>{' '}
          with header <code className="bg-gray-50 px-1 rounded">x-cron-secret: &lt;CRON_SECRET from .env&gt;</code>.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
          <span>Last run: <strong>{fmtTime(diag.lastCronRun)}</strong></span>
          <span>Result: <strong>{diag.lastCronSummary ? `${diag.lastCronSummary.live ?? '—'} live / ${diag.lastCronSummary.refreshed ?? '—'} refreshed` : '—'}</strong></span>
        </div>
        <button onClick={handleRefreshAll} disabled={refreshing}
          className="px-5 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">
          {refreshing ? 'Refreshing...' : 'Refresh all prices now'}
        </button>
      </div>
    </div>
  );
}

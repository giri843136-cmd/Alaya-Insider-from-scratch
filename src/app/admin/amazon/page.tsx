'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-auth-context';

interface Diagnostics {
  store: 'in' | 'us';
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
  store?: 'in' | 'us';
  testedAt: string;
  asins: string[];
  httpStatus: number | null;
  errors: { code: string; message: string }[];
  items: any[];
  diagnostics?: { configured?: boolean; source?: string | null; partnerTag?: string; marketplace?: string };
}

interface CacheRow {
  store: string;
  asin: string;
  ok: boolean;
  price: number | null;
  currency: string | null;
  available: boolean;
  error_code: string;
  error_message: string;
  fetched_at: string;
  product_name: string | null;
  product_id: string | null;
}

interface StoreTabState {
  diag: Diagnostics;
  clientId: string;
  clientSecret: string;
  version: string;
  partnerTag: string;
  tokenEndpoint: string;
  testAsins: string[];
  testResult: TestResult | null;
  testing: boolean;
  saving: boolean;
  tagWarning: string;
}

const STORE_META: Record<'in' | 'us', { label: string; marketplace: string; version: string; tag: string; currency: string; signup: string; eligNote: string }> = {
  in: {
    label: 'India 🇮🇳',
    marketplace: 'www.amazon.in',
    version: '3.2',
    tag: 'alayainsider-21',
    currency: 'INR (₹)',
    signup: 'https://affiliate-program.amazon.in',
    eligNote: 'India Associates approval required — the Creators API button unlocks after account approval / qualifying sales.',
  },
  us: {
    label: 'United States 🇺🇸',
    marketplace: 'www.amazon.com',
    version: '3.1',
    tag: 'alayainsider-20',
    currency: 'USD ($)',
    signup: 'https://affiliate-program.amazon.com',
    eligNote: 'US Associates approval required — the Creators API button unlocks after account approval / qualifying sales. Until then this tab simply shows "Not configured" and the site runs India-first.',
  },
};

const DEFAULT_DIAG: Record<'in' | 'us', Diagnostics> = {
  in: { store: 'in', configured: false, source: null, clientId: '', version: '3.2', partnerTag: 'alayainsider-21', marketplace: 'www.amazon.in', tokenEndpoint: '', secretStored: false, lastError: null, lastErrorAt: null, lastSuccessAt: null, lastTest: null, lastCronRun: null, lastCronSummary: null },
  us: { store: 'us', configured: false, source: null, clientId: '', version: '3.1', partnerTag: 'alayainsider-20', marketplace: 'www.amazon.com', tokenEndpoint: '', secretStored: false, lastError: null, lastErrorAt: null, lastSuccessAt: null, lastTest: null, lastCronRun: null, lastCronSummary: null },
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
  return { tone: 'warn', text: 'No items returned for the tested ASINs (they may not be accessible on this marketplace).' };
}

/** Success checklist rendered after a passing connection test. */
function SuccessChecklist({ result }: { result: TestResult | null }) {
  if (!result || result.items?.length === 0) return null;
  const it = result.items.find((i: any) => i.priceAmount != null) || result.items[0];
  const hasPrice = it?.priceAmount != null;
  const checks = [
    { label: 'Product image from Amazon', pass: !!it?.imageUrl },
    { label: 'Live price', pass: hasPrice },
    { label: 'Availability', pass: !!it?.availabilityType },
    { label: '"as of" stamp (rendered on product pages)', pass: true },
    { label: `Partner tag in link (${result.diagnostics?.partnerTag || '—'})`, pass: (it?.detailPageURL || '').includes(result.diagnostics?.partnerTag || 'zzz-nomatch') },
  ];
  const allPass = checks.every(c => c.pass);
  return (
    <div className={`mt-4 border rounded-lg p-4 ${allPass ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <p className="text-sm font-medium mb-2 text-gray-800">{allPass ? '✅ Success checklist' : '⚠️ Success checklist'}</p>
      <ul className="space-y-1">
        {checks.map(c => (
          <li key={c.label} className={`text-xs ${c.pass ? 'text-green-700' : 'text-amber-700'}`}>
            {c.pass ? '✓' : '✗'} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function emptyTab(store: 'in' | 'us'): StoreTabState {
  return {
    diag: { ...DEFAULT_DIAG[store] },
    clientId: '',
    clientSecret: '',
    version: DEFAULT_DIAG[store].version,
    partnerTag: DEFAULT_DIAG[store].partnerTag,
    tokenEndpoint: '',
    testAsins: ['', '', ''],
    testResult: null,
    testing: false,
    saving: false,
    tagWarning: '',
  };
}

export default function AdminAmazon() {
  const [tab, setTab] = useState<'in' | 'us'>('in');
  const [tabs, setTabs] = useState<Record<'in' | 'us', StoreTabState>>(() => ({ in: emptyTab('in'), us: emptyTab('us') }));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [cache, setCache] = useState<CacheRow[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [refreshingAsin, setRefreshingAsin] = useState<string | null>(null);

  // OneLink section
  const [onelinkSnippet, setOnelinkSnippet] = useState('');
  const [onelinkInstalled, setOnelinkInstalled] = useState(false);
  const [onelinkSrcs, setOnelinkSrcs] = useState<string[]>([]);
  const [onelinkError, setOnelinkError] = useState('');

  // Diagnostics viewer
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logStore, setLogStore] = useState('all');
  const [logLoading, setLogLoading] = useState(false);

  // Ticking clock for TTL countdowns (keeps rendering pure — no Date.now in JSX).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };
  const setTabState = (patch: Partial<StoreTabState>) => setTabs(t => ({ ...t, [tab]: { ...t[tab], ...patch } }));
  const current = tabs[tab];

  const loadStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/creators/settings');
      const data = await res.json();
      if (data.stores) {
        const next = { in: emptyTab('in'), us: emptyTab('us') };
        for (const s of ['in', 'us'] as const) {
          const d: Diagnostics = { ...DEFAULT_DIAG[s], ...data.stores[s] };
          next[s] = {
            ...next[s],
            diag: d,
            clientId: d.clientId || next[s].clientId, // masked value; user only overwrites when replacing keys
            version: d.version || next[s].version,
            partnerTag: d.partnerTag || next[s].partnerTag,
            tokenEndpoint: d.tokenEndpoint || next[s].tokenEndpoint,
            testResult: d.lastTest || next[s].testResult,
          };
        }
        setTabs(next);
      }
      if (data.onelink) {
        setOnelinkInstalled(!!data.onelink.installed);
        setOnelinkSrcs(data.onelink.srcs || []);
        setOnelinkError(data.onelink.error || '');
      }
      if (Array.isArray(data.cache)) setCache(data.cache);
    } catch {
      setError('Could not load status. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => { await loadStatus(); };
    void run();
  }, [loadStatus]);

  const handleSave = async () => {
    setTabState({ saving: true, tagWarning: '' }); setError('');
    try {
      const res = await adminFetch('/api/creators/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: tab,
          clientId: current.clientId,
          clientSecret: current.clientSecret,
          version: current.version,
          partnerTag: current.partnerTag,
          marketplace: STORE_META[tab].marketplace,
          tokenEndpoint: current.tokenEndpoint,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTabState({ clientSecret: '', tagWarning: data.warning || '' }); // never echo the secret back
        showToast(`${STORE_META[tab].label} credentials saved`);
        await loadStatus();
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (e: any) {
      setError('Could not save: ' + (e?.message || e));
    } finally { setTabState({ saving: false }); }
  };

  const handleClear = async () => {
    if (!confirm(`Remove stored ${STORE_META[tab].label} Creators API credentials? The site will fall back to text-link mode for this store until new keys are saved.`)) return;
    setError('');
    try {
      const res = await adminFetch('/api/creators/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true, store: tab }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTabState({ clientId: '', clientSecret: '', version: STORE_META[tab].version, partnerTag: STORE_META[tab].tag, tokenEndpoint: '', testResult: null });
        showToast(`${STORE_META[tab].label} credentials cleared — fallback text-link mode active`);
        await loadStatus();
      } else setError(data.error || 'Clear failed');
    } catch (e: any) { setError('Could not clear: ' + (e?.message || e)); }
  };

  const handleTest = async (forceToken = true) => {
    const asins = current.testAsins.map(a => a.trim().toUpperCase()).filter(Boolean);
    if (asins.length === 0) { setError(`Enter at least one 10-character ${STORE_META[tab].marketplace} ASIN to test.`); return; }
    setTabState({ testing: true }); setError('');
    try {
      const res = await adminFetch('/api/creators/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asins, force: forceToken, store: tab }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Test failed'); setTabState({ testResult: null }); }
      else { setTabState({ testResult: data }); }
    } catch (e: any) {
      setError('Test request failed: ' + (e?.message || e));
    } finally { setTabState({ testing: false }); }
  };

  const handleRefreshAll = async () => {
    setCacheLoading(true); setError('');
    try {
      const res = await adminFetch('/api/cron/amazon-prices', { method: 'POST' });
      const data = await res.json();
      if (res.ok) { showToast(data.message || 'Refresh complete'); await loadStatus(); }
      else setError(data.error || 'Refresh failed');
    } catch (e: any) { setError('Refresh request failed: ' + (e?.message || e)); }
    finally { setCacheLoading(false); }
  };

  const handleRefreshRow = async (store: string, asin: string) => {
    setRefreshingAsin(`${store}:${asin}`); setError('');
    try {
      const res = await adminFetch('/api/creators/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, asin }),
      });
      const data = await res.json();
      if (res.ok) { showToast(`${asin} refreshed`); await loadStatus(); }
      else setError(data.error || 'Refresh failed');
    } catch (e: any) { setError('Refresh request failed: ' + (e?.message || e)); }
    finally { setRefreshingAsin(null); }
  };

  const handleSaveOneLink = async () => {
    setOnelinkError(''); setError('');
    try {
      const res = await adminFetch('/api/creators/onelink', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: onelinkSnippet }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOnelinkInstalled(true);
        setOnelinkSrcs(data.srcs || []);
        showToast('OneLink snippet saved & validated — script will load site-wide');
      } else {
        setOnelinkError(data.error || 'Snippet rejected');
      }
    } catch (e: any) { setOnelinkError('Could not save: ' + (e?.message || e)); }
  };

  const handleLoadLogs = async () => {
    setLogLoading(true);
    try {
      const res = await adminFetch(`/api/creators/logs?store=${logStore}&lines=50`);
      const data = await res.json();
      if (res.ok) setLogLines(data.lines || []);
      else setLogLines([`Error: ${data.error || 'failed to load'}`]);
    } catch { setLogLines(['Could not load logs']); }
    finally { setLogLoading(false); }
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading Amazon API status...</div>;

  const verdict = friendlyVerdict(current.testResult);
  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-md text-sm';
  const ttlLeft = (fetchedAt: string, ok: boolean) => {
    const ttlMs = ok ? 3600 * 1000 : 60 * 1000;
    const left = Math.max(0, ttlMs - (now - Date.parse(fetchedAt)));
    return Math.ceil(left / 1000 / 60) + 'm';
  };

  return (
    <div className="max-w-5xl">
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Amazon API — Dual Store</h1>
          <p className="text-xs text-gray-400 mt-1">Amazon Creators API · amazon.in + amazon.com — the official replacement for PA-API 5.0 (retired 15 May 2026)</p>
        </div>
        <button onClick={handleRefreshAll} disabled={cacheLoading}
          className="px-4 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">
          {cacheLoading ? 'Refreshing...' : 'Refresh all prices now'}
        </button>
      </div>

      {/* Store tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-100 pb-px">
        {(['in', 'us'] as const).map(s => (
          <button key={s} onClick={() => setTab(s)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${tab === s ? 'bg-white border border-gray-100 border-b-white text-accent -mb-px' : 'text-gray-400 hover:text-gray-600'}`}>
            {STORE_META[s].label}
            <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${tabs[s].diag.configured ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {tabs[s].diag.configured ? 'Configured' : 'Not configured'}
            </span>
          </button>
        ))}
      </div>

      {/* Credentials */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-700">Credentials — {STORE_META[tab].label}</h2>
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${current.diag.configured ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
            {current.diag.configured ? 'Configured ✓' : 'Not configured'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-1">
          ID <code className="bg-gray-50 px-1 rounded">{current.diag.clientId || '—'}</code> · v{current.diag.version || STORE_META[tab].version} · tag <code className="bg-gray-50 px-1 rounded">{current.diag.partnerTag || '—'}</code> · {current.diag.marketplace || STORE_META[tab].marketplace}
        </p>
        <p className="text-xs text-gray-400 mb-4">Secret is encrypted at rest and never shown again after saving — leave the Secret field blank to keep the stored one.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Credential ID</label>
            <input className={inputCls} value={current.clientId} onChange={e => setTabState({ clientId: e.target.value })}
              placeholder={current.diag.clientId ? `Stored: ${current.diag.clientId} (replace only if rotated)` : 'e.g. amzn1.application-oa2-client.…'} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Credential Secret</label>
            <input type="password" className={inputCls} value={current.clientSecret} onChange={e => setTabState({ clientSecret: e.target.value })}
              autoComplete="new-password"
              placeholder={current.diag.secretStored ? '•••••••• (unchanged — blank keeps it)' : 'Paste secret (shown once at creation)'} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Credential Version</label>
            <select className={inputCls} value={current.version} onChange={e => setTabState({ version: e.target.value })}>
              <option value="3.1">3.1 — North America (api.amazon.com)</option>
              <option value="3.2">3.2 — EU incl. India (api.amazon.co.uk)</option>
              <option value="3.3">3.3 — Far East (api.amazon.co.jp)</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Pre-set: {STORE_META[tab].label} → {STORE_META[tab].version}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Partner Tag</label>
            <input className={inputCls} value={current.partnerTag} onChange={e => setTabState({ partnerTag: e.target.value })}
              placeholder={STORE_META[tab].tag} />
            {current.tagWarning && <p className="text-[11px] text-amber-600 mt-1">{current.tagWarning}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Marketplace</label>
            <input className={`${inputCls} bg-gray-50 text-gray-500`} value={STORE_META[tab].marketplace} readOnly />
            <p className="text-[11px] text-gray-400 mt-1">Fixed per store — not editable.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Token endpoint override (optional)</label>
            <input className={inputCls} value={current.tokenEndpoint} onChange={e => setTabState({ tokenEndpoint: e.target.value })}
              placeholder={`Auto from version — e.g. ${tab === 'us' ? 'https://api.amazon.com/auth/o2/token' : 'https://api.amazon.co.uk/auth/o2/token'}`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <button onClick={handleSave} disabled={current.saving}
            className="px-5 py-2 bg-accent text-white text-sm rounded-md disabled:opacity-50">{current.saving ? 'Saving...' : 'Save credentials'}</button>
          <button onClick={handleClear}
            className="px-4 py-2 text-red-600 text-sm border border-red-200 rounded-md hover:bg-red-50">Clear credentials (confirm dialog)</button>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 text-xs text-gray-500">
          <p className="font-medium text-gray-600 mb-1">Last connection test</p>
          <p>Result: <strong>{current.testResult ? `HTTP ${current.testResult.httpStatus ?? '—'}` : 'not run yet'}</strong> · at {fmtTime(current.testResult?.testedAt || null)}</p>
          {current.diag.lastSuccessAt && <p className="text-green-600 mt-0.5">Last successful API call: {fmtTime(current.diag.lastSuccessAt)}</p>}
          {current.diag.lastErrorAt && <p className="text-red-500 mt-0.5">Last error: {fmtTime(current.diag.lastErrorAt)}{current.diag.lastError ? ` — ${current.diag.lastError.code}: ${current.diag.lastError.message.slice(0, 120)}` : ''}</p>}
        </div>
      </div>

      {/* Test */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Connection test (health check) — {STORE_META[tab].label}</h2>
        <p className="text-xs text-gray-400 mb-4">
          Runs a real GetItems request to <code className="bg-gray-50 px-1 rounded">creatorsapi.amazon</code> for <strong>{STORE_META[tab].marketplace}</strong> with the stored credentials.
          Dummy keys ⇒ OAuth <em>invalid_client</em> error = plumbing OK. Real keys ⇒ live prices below.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          {VERIFICATION_LABELS.map((label, i) => (
            <div key={label}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{label} — {STORE_META[tab].marketplace} ASIN</label>
              <input className={inputCls} value={current.testAsins[i]} onChange={e => { const next = [...current.testAsins]; next[i] = e.target.value; setTabState({ testAsins: next }); }}
                placeholder="e.g. B0XXXXXXXX (from the product page URL)" maxLength={10} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={() => handleTest(true)} disabled={current.testing}
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-md disabled:opacity-50">{current.testing ? 'Testing...' : 'Run connection test'}</button>
        </div>

        {current.testResult && (
          <div className="mt-5 border rounded-lg overflow-hidden">
            <div className={`px-4 py-3 text-sm ${verdict.tone === 'ok' ? 'bg-green-50 text-green-800' : verdict.tone === 'err' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
              <strong>{current.testResult.httpStatus != null ? `HTTP ${current.testResult.httpStatus}` : 'No HTTP response'} · </strong>{verdict.text}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 mb-3 font-mono">
                Tested {current.testResult.testedAt} — asins: {current.testResult.asins.join(', ')}
                {current.testResult.errors?.length > 0 && <> · Amazon error: <span className="text-red-500">{current.testResult.errors.map(e => `${e.code}: ${e.message}`).join(' | ')}</span></>}
              </p>
              {current.testResult.items?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {current.testResult.items.map((it: any) => (
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
                <p className="text-xs text-gray-400">No items returned. {current.testResult.errors?.length ? 'See the error above.' : 'The ASINs may not be accessible on this marketplace — verify them on an open product page.'}</p>
              )}
              <SuccessChecklist result={current.testResult} />
            </div>
          </div>
        )}
      </div>

      {/* Per-store cron status */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Hourly refresh — {STORE_META[tab].label}</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-2">
          <span>Last run: <strong>{fmtTime(current.diag.lastCronRun)}</strong></span>
          <span>Result: <strong>{current.diag.lastCronSummary ? `${current.diag.lastCronSummary.live ?? '—'} live / ${current.diag.lastCronSummary.refreshed ?? '—'} refreshed` : '—'}</strong></span>
        </div>
      </div>

      {/* Store signup links */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Get credentials</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-500">
          <a href={STORE_META.in.signup} target="_blank" rel="noopener noreferrer" className="border border-gray-100 rounded-lg p-4 hover:border-accent/30 transition-colors">
            <p className="font-medium text-gray-700 mb-1">India 🇮🇳 — {STORE_META.in.signup.replace('https://', '')}</p>
            <p className="text-gray-400">Tools → Creators API. {STORE_META.in.eligNote}</p>
          </a>
          <a href={STORE_META.us.signup} target="_blank" rel="noopener noreferrer" className="border border-gray-100 rounded-lg p-4 hover:border-accent/30 transition-colors">
            <p className="font-medium text-gray-700 mb-1">United States 🇺🇸 — {STORE_META.us.signup.replace('https://', '')}</p>
            <p className="text-gray-400">Tools → Creators API. {STORE_META.us.eligNote}</p>
          </a>
        </div>
      </div>

      {/* Cron helper */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Cron helper</h2>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          Point an external cron service (cron-job.org, UptimeRobot) at this URL hourly. <code className="bg-gray-50 px-1 rounded">CRON_SECRET</code> lives in the server&apos;s <code className="bg-gray-50 px-1 rounded">.env</code> (Hostinger: hPanel → Node.js app → environment variables).
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs bg-gray-50 border border-gray-100 rounded px-3 py-2 font-mono">POST https://alayainsider.com/api/cron/amazon-prices</code>
          <button onClick={() => { navigator.clipboard?.writeText('POST https://alayainsider.com/api/cron/amazon-prices\nHeader: x-cron-secret: <CRON_SECRET>\nBody: {}'); showToast('Copied'); }}
            className="px-3 py-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50">Copy</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Refreshes both stores (India + US when configured). Next scheduled run: ~{fmtTime(current.diag.lastCronRun ? new Date(new Date(current.diag.lastCronRun).getTime() + 3600 * 1000).toISOString() : null)} (hourly cadence from your cron service).</p>
      </div>

      {/* OneLink */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-700">Amazon OneLink (9 secondary marketplaces)</h2>
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${onelinkInstalled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
            {onelinkInstalled ? `Installed (${onelinkSrcs.length} script${onelinkSrcs.length === 1 ? '' : 's'})` : 'Not installed'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          OneLink rewrites Amazon product anchors for visitors outside India/US to their local store with the -20 tag.
          Paste the snippet from your US Associates account (Account Settings → OneLink). Only
          <code className="bg-gray-50 px-1 rounded"> script src=…amazon-adsystem.com / amazon.com / amazon.co.uk</code> is accepted — anything else is rejected.
          Product links on this site are direct Amazon URLs (no internal redirector), which is exactly what OneLink needs.
        </p>
        <textarea className={`${inputCls} font-mono text-xs h-28 mb-2`} value={onelinkSnippet}
          onChange={e => setOnelinkSnippet(e.target.value)}
          placeholder='<script src="https://z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US"></script>' />
        {onelinkError && <p className="text-[11px] text-red-600 mb-2">{onelinkError}</p>}
        <div className="flex items-center gap-3">
          <button onClick={handleSaveOneLink} className="px-5 py-2 bg-accent text-white text-sm rounded-md">Save & validate</button>
          {onelinkInstalled && <span className="text-xs text-gray-400">Loaded site-wide via next/script (afterInteractive).</span>}
        </div>
      </div>

      {/* Cached prices table */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Cached prices</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Store</th>
                <th className="py-2 pr-3 font-medium">ASIN</th>
                <th className="py-2 pr-3 font-medium">Cached price</th>
                <th className="py-2 pr-3 font-medium">Fetched</th>
                <th className="py-2 pr-3 font-medium">TTL left</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {cache.length === 0 && <tr><td colSpan={7} className="py-4 text-gray-400">No cached prices yet — run the connection test or refresh to populate.</td></tr>}
              {cache.map(r => (
                <tr key={`${r.store}:${r.asin}`} className="border-b border-gray-50">
                  <td className="py-2 pr-3 text-gray-700 max-w-[180px] truncate">{r.product_name || '—'}</td>
                  <td className="py-2 pr-3">{r.store === 'us' ? '🇺🇸 us' : '🇮🇳 in'}</td>
                  <td className="py-2 pr-3 font-mono">{r.asin}</td>
                  <td className="py-2 pr-3">
                    {r.price != null ? <span className="font-medium">{r.currency}{' '}{r.price}</span> : <span className="text-gray-400">{r.error_code || '—'}</span>}
                  </td>
                  <td className="py-2 pr-3 text-gray-400">{fmtTime(r.fetched_at)}</td>
                  <td className="py-2 pr-3 text-gray-400">{ttlLeft(r.fetched_at, r.ok)}</td>
                  <td className="py-2">
                    <button onClick={() => handleRefreshRow(r.store, r.asin)} disabled={refreshingAsin === `${r.store}:${r.asin}`}
                      className="px-2.5 py-1 text-[11px] border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50">
                      {refreshingAsin === `${r.store}:${r.asin}` ? '...' : 'Refresh'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostics log viewer */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Diagnostics log</h2>
          <div className="flex items-center gap-2">
            <select className="text-xs border border-gray-200 rounded px-2 py-1.5" value={logStore} onChange={e => setLogStore(e.target.value)}>
              <option value="all">All stores</option>
              <option value="in">🇮🇳 India</option>
              <option value="us">🇺🇸 US</option>
            </select>
            <button onClick={handleLoadLogs} disabled={logLoading}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">{logLoading ? 'Loading...' : 'Load'}</button>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mb-2">Last 50 lines of <code className="bg-gray-50 px-1 rounded">data/logs/creators-api.log</code> (server-side only).</p>
        <pre className="bg-gray-900 text-gray-100 text-[10px] leading-relaxed rounded-lg p-3 overflow-x-auto max-h-72">{logLines.join('\n') || 'Click Load to fetch the log.'}</pre>
      </div>
    </div>
  );
}
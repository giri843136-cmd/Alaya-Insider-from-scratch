'use client';
import { useState } from 'react';
import { adminFetch } from '@/lib/admin-auth-context';

const EXAMPLE = `name,category,brand,short_description,why_we_recommend,pros,cons,tags,primary_image,india_asin,us_asin,current_price,currency,status
Anouk Cotton Kurti Set,Women,Anouk,Everyday cotton kurti set with palazzo.,Soft breathable cotton and a flattering A-line cut.,Breathable|Easy care,Runs slightly long,kurti set|women|ethnic wear,https://example.com/kurti.jpg,B0AAAA1111,B0BBBB2222,1499,INR,draft`;

interface RowResult {
  line: number;
  name: string;
  ok: boolean;
  error?: string;
  slug?: string;
  warnings?: string[];
}

export default function AdminImport() {
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [result, setResult] = useState<{ imported: number; failed: number; unknownColumns: string[]; rows: RowResult[] } | null>(null);
  const [fixResult, setFixResult] = useState<any>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const handleImport = async () => {
    if (!csv.trim()) { showToast('Paste a CSV first'); return; }
    setBusy(true);
    try {
      const res = await adminFetch('/api/products/import', { method: 'POST', body: JSON.stringify({ csv }) });
      const data = await res.json();
      if (!res.ok) { showToast(data?.error || 'Import failed'); return; }
      setResult(data);
      showToast(`Imported ${data.imported} product${data.imported === 1 ? '' : 's'}${data.failed ? `, ${data.failed} failed` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Bulk import products (CSV)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a CSV with a header row. Required: <code className="text-xs bg-gray-100 px-1 rounded">name</code>,{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">category</code>. Optional:{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">brand, short_description, why_we_recommend, best_for,
          pros, cons, tags, buying_advice, primary_image, india_asin, us_asin, current_price, currency, rating,
          review_count, status, seo_title, seo_description</code>.
          Pros / cons / tags are pipe (<code className="text-xs bg-gray-100 px-1 rounded">|</code>) separated.
          ASINs build the tagged amazon.in / amazon.com links automatically. Rows import as{' '}
          <strong>draft</strong> unless <code className="text-xs bg-gray-100 px-1 rounded">status=published</code>.
        </p>
        <p className="text-xs text-amber-700 mt-2">
          ⚠️ Verify every ASIN in your browser (amazon.in/dp/&lt;ASIN&gt; and amazon.com/dp/&lt;ASIN&gt;) before importing —
          the 2026-09-04 audit found the previous catalog&apos;s ASINs were invalid on both marketplaces.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">CSV content</label>
          <button
            onClick={() => { setCsv(EXAMPLE); setResult(null); }}
            className="text-xs text-accent hover:underline"
          >
            Insert example
          </button>
        </div>
        <textarea
          value={csv}
          onChange={e => { setCsv(e.target.value); setResult(null); }}
          spellCheck={false}
          rows={14}
          className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-mono"
          placeholder="name,category,brand,india_asin,us_asin,status&#10;My Product,Women,MyBrand,B0AAAA1111,B0BBBB2222,draft"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={busy}
          className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import products'}
        </button>
        {toast && <span className="text-sm text-gray-600">{toast}</span>}
      </div>

      <div className="border border-gray-100 rounded-lg p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Existing catalog — apply verified link fixes</h2>
          <p className="text-xs text-gray-500 mt-1">
            The seeded ASINs are invalid on both marketplaces (live audit, 2026-09-04). This applies the
            verified amazon.in/com ASINs to the existing products, neutralizes the 4 with no US listing, and
            archives/drafts the 8 products with no amazon.in listing. Backs up the database first.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setBusy(true);
              try {
                const res = await adminFetch('/api/products/apply-amazon-fixes', { method: 'POST', body: JSON.stringify({ dryRun: true }) });
                const data = await res.json();
                setResult(null);
                setFixResult(data);
                showToast(data?.error || `Preview: ${data.changed} change${data.changed === 1 ? '' : 's'} ready to apply`);
              } finally { setBusy(false); }
            }}
            disabled={busy}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Preview fixes
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Apply verified link fixes to the existing catalog? A database backup is taken first.')) return;
              setBusy(true);
              try {
                const res = await adminFetch('/api/products/apply-amazon-fixes', { method: 'POST', body: JSON.stringify({}) });
                const data = await res.json();
                setFixResult(data);
                showToast(data?.error || `Applied ${data.changed} fixes${data.backup ? ` · backup ${data.backup}` : ''}`);
              } finally { setBusy(false); }
            }}
            disabled={busy}
            className="px-3 py-2 bg-accent text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            Apply verified link fixes
          </button>
        </div>
        {fixResult && (
          <div className="text-sm text-gray-700">
            <p className="mb-1">
              {fixResult.dryRun ? 'Preview — nothing written.' : `Applied ${fixResult.changed} changes.`}
              {fixResult.backup ? ` Backup: ${fixResult.backup}` : ''}
              {fixResult.message ? ` ${fixResult.message}` : ''}
            </p>
            {fixResult.outcomes?.some((o: any) => !o.action.startsWith('ok')) && (
              <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden mt-2">
                <thead className="bg-gray-50 text-left text-gray-500"><tr><th className="px-2 py-1">Slug</th><th className="px-2 py-1">Action</th><th className="px-2 py-1">Detail</th></tr></thead>
                <tbody>
                  {fixResult.outcomes.filter((o: any) => !o.action.startsWith('ok')).map((o: any) => (
                    <tr key={o.slug + o.action} className="border-t border-gray-100">
                      <td className="px-2 py-1">{o.slug}</td>
                      <td className="px-2 py-1">{o.action}</td>
                      <td className="px-2 py-1 text-gray-500">{o.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-3">
          <div className="text-sm text-gray-700">
            {result.imported} imported · {result.failed} failed
            {result.unknownColumns.length > 0 && (
              <span className="ml-2 text-amber-600">
                unknown columns ignored: {result.unknownColumns.join(', ')}
              </span>
            )}
          </div>
          {result.rows.some(r => !r.ok) && (
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr><th className="px-3 py-2">Line</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {result.rows.filter(r => !r.ok).map(r => (
                  <tr key={r.line} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-400">{r.line}</td>
                    <td className="px-3 py-2">{r.name || '—'}</td>
                    <td className="px-3 py-2 text-red-600">{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.rows.some(r => r.ok) && (
            <div className="text-xs text-gray-500">
              {result.rows.filter(r => r.ok).map(r => `${r.name} → /product/${r.slug} (draft)`).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

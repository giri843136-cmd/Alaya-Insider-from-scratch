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

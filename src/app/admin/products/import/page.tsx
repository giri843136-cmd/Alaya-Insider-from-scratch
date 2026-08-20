'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useRef } from 'react';

function parseCSV(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === '\n' && !inQuotes) {
      if (current.trim() || lines.length > 0) lines.push(current);
      current = '';
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  if (lines.length < 2) return [];

  const splitRow = (row: string): string[] => {
    const vals: string[] = [];
    let val = '';
    let q = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { if (q && row[i + 1] === '"') { val += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { vals.push(val.trim()); val = ''; }
      else val += c;
    }
    vals.push(val.trim());
    return vals;
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const values = splitRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter(obj => Object.values(obj).some(v => v.trim()));
}

const COLUMNS = [
  { key: 'name', required: true }, { key: 'brand' }, { key: 'category' }, { key: 'subcategory' },
  { key: 'price' }, { key: 'previous_price' }, { key: 'rating' }, { key: 'review_count' },
  { key: 'description' }, { key: 'why_we_recommend' }, { key: 'best_for' },
  { key: 'benefits' }, { key: 'pros' }, { key: 'cons' }, { key: 'buying_advice' },
  { key: 'affiliate_url' }, { key: 'marketplace' }, { key: 'affiliate_network' },
  { key: 'cta_text' }, { key: 'sku' }, { key: 'status' },
  { key: 'is_featured' }, { key: 'is_trending' }, { key: 'is_editors_pick' },
  { key: 'seo_title' }, { key: 'seo_description' },
];

export default function ImportProducts() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setResult({ error: 'Could not parse the file. Make sure it is a valid CSV with headers in the first row.' });
        return;
      }
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handlePaste = (text: string) => {
    setResult(null);
    const parsed = parseCSV(text);
    if (parsed.length > 0) {
      setRows(parsed);
      setFileName('Pasted data');
      setStep('preview');
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await adminFetch('/api/products/import', {
        method: 'POST',
        body: JSON.stringify({ products: rows }),
      });
      const data = await res.json();
      setResult(data);
      setStep('done');
    } catch {
      setResult({ error: 'Import failed. Please try again.' });
    }
    setImporting(false);
  };

  const reset = () => {
    setRows([]); setFileName(''); setResult(null); setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  const detectedColumns = rows.length > 0 ? COLUMNS.filter(c => c.key in rows[0]) : [];
  const missingRequired = rows.length > 0 ? COLUMNS.filter(c => c.required && !(c.key in rows[0])) : [];
  const emptyNames = rows.filter(r => !(r.name || '').trim()).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Import Products</h1>
          <p className="text-sm text-gray-400 mt-1">Add products in bulk using a CSV file</p>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:border-accent">
            Start Over
          </button>
        )}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <>
          <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Upload your CSV file</h2>
            <p className="text-xs text-gray-500 mb-4">
              Fill in your product details in a CSV file and upload it here.
            </p>

            {/* Download Sample CSV */}
            <div className="mb-6">
              <button
                onClick={() => {
                  // Try every method - one of them has to work
                  const url = window.location.origin + '/api/products/sample-csv';
                  
                  // Method 1: window.top navigation
                  try { (window.top || window).location.href = url; return; } catch(e) {}
                  
                  // Method 2: window.open  
                  try { const w = window.open(url, '_blank'); if (w) return; } catch(e) {}
                  
                  // Method 3: parent.location
                  try { window.parent.location.href = url; return; } catch(e) {}
                  
                  // Method 4: direct location
                  try { window.location.href = url; } catch(e) {}
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-light transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Sample CSV
              </button>
              <p className="text-xs text-gray-400 mt-2">Download the template, replace with your data, and upload below.</p>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <label className="cursor-pointer">
                <span className="text-sm text-accent font-medium hover:underline">Choose a CSV file</span>
                <span className="text-sm text-gray-400"> or drag and drop</span>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
              <p className="text-xs text-gray-400 mt-2">.csv files only</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Or paste CSV data directly</h2>
            <textarea
              rows={6}
              placeholder={"name,brand,category,price,rating,description,affiliate_url\nProduct Name,Brand,Category,29.99,4.5,Description text,https://..."}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono mb-3"
              onBlur={e => { if (e.target.value.trim()) handlePaste(e.target.value); }}
            />
            <p className="text-xs text-gray-400">Paste your data and click outside the box to preview.</p>
          </div>

          {result?.error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}
        </>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div>
          <div className="bg-white border border-gray-100 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Preview: {rows.length} products found</h2>
                <p className="text-xs text-gray-400 mt-0.5">Source: {fileName}</p>
              </div>
              <span className="text-xs text-gray-400">{detectedColumns.length} of {COLUMNS.length} columns detected</span>
            </div>

            {missingRequired.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-700 font-medium">Missing required columns: {missingRequired.map(c => c.key).join(', ')}</p>
              </div>
            )}

            {emptyNames > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
                <p className="text-sm text-amber-700">{emptyNames} row(s) have empty names and will be skipped.</p>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-4">
              {COLUMNS.map(c => (
                <span key={c.key} className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  c.key in (rows[0] || {}) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}>
                  {c.key} {c.key in (rows[0] || {}) ? '✓' : '—'}
                </span>
              ))}
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 w-10">#</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 min-w-[180px]">Name</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500">Brand</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500">Category</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500">Price</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500">Rating</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500">Affiliate URL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${!(r.name || '').trim() ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="p-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="p-2 text-gray-800 font-medium">{r.name || <span className="text-red-400 text-xs">Missing</span>}</td>
                      <td className="p-2 text-gray-500 text-xs">{r.brand || '—'}</td>
                      <td className="p-2 text-gray-500 text-xs">{r.category || '—'}</td>
                      <td className="p-2 text-gray-700">{r.price ? `$${r.price}` : '—'}</td>
                      <td className="p-2 text-gray-500">{r.rating || '—'}</td>
                      <td className="p-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${r.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.status || 'draft'}
                        </span>
                      </td>
                      <td className="p-2 text-gray-400 text-xs max-w-[200px] truncate">{r.affiliate_url || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-xs text-gray-400 p-3 text-center border-t border-gray-100">
                  Showing first 20 of {rows.length} rows
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={handleImport} disabled={importing || missingRequired.length > 0}
              className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-50">
              {importing ? 'Importing...' : `Import ${rows.length} Products`}
            </button>
            <button onClick={reset} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'done' && result && (
        <div className="bg-white border border-gray-100 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Import Complete</h2>
          <div className="grid grid-cols-2 gap-4 mb-6 max-w-sm">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-green-700">{result.imported}</p>
              <p className="text-xs text-green-600 mt-1">Imported</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-amber-700">{result.skipped}</p>
              <p className="text-xs text-amber-600 mt-1">Skipped</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Issues</h3>
              <div className="bg-gray-50 rounded-md p-4 max-h-48 overflow-y-auto">
                {result.errors.map((e: string, i: number) => (
                  <p key={i} className="text-xs text-gray-600 py-0.5">{e}</p>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <a href="/admin/products" className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-light transition-colors">
              View Products
            </a>
            <button onClick={reset} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:border-accent">
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

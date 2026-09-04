'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminMedia() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');

  const fetchMedia = async () => {
    const res = await adminFetch('/api/media');
    const data = await res.json();
    setMedia(data.media || []);
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => { await fetchMedia(); };
    void run();
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await adminFetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) { showToast('File uploaded'); fetchMedia(); }
    else { showToast('Upload failed'); }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this file?')) return;
    await adminFetch('/api/media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('File deleted');
    fetchMedia();
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('URL copied');
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Media Library</h1>
        <label className="px-4 py-2 bg-accent text-white text-sm rounded-md cursor-pointer hover:bg-accent-light">
          {uploading ? 'Uploading...' : 'Upload'}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square skeleton rounded-lg" />)}
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>No media files yet</p>
          <p className="text-sm mt-1">Upload images to use in products and articles</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {media.map(m => (
            <div key={m.id} className="group relative border border-gray-100 rounded-lg overflow-hidden">
              <div className="aspect-square bg-gray-50">
                <img src={m.url} alt={m.alt_text || m.original_name} className="w-full h-full object-cover" />
              </div>
              <div className="p-2">
                <p className="text-xs text-gray-600 truncate">{m.original_name}</p>
                <p className="text-[10px] text-gray-400">{(m.file_size / 1024).toFixed(0)} KB</p>
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => copyUrl(m.url)} className="px-2 py-1 bg-white text-xs rounded">Copy URL</button>
                <button onClick={() => handleDelete(m.id)} className="px-2 py-1 bg-red-500 text-white text-xs rounded">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

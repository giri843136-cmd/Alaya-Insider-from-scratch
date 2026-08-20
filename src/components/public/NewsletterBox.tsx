'use client';
import { useState } from 'react';

interface Props {
  title?: string; subtitle?: string; ctaText?: string; source?: string; compact?: boolean; dark?: boolean;
}

export default function NewsletterBox({ title = 'Get the Good Finds First', subtitle = 'One useful email with curated products, shopping guides and new discoveries.', ctaText = 'Join Free', source = 'website', compact = false, dark = false }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source }) });
      const data = await res.json();
      if (res.ok) { setStatus('success'); setMessage(data.message || 'Thank you!'); setEmail(''); }
      else { setStatus('error'); setMessage(data.error || 'Something went wrong.'); }
    } catch { setStatus('error'); setMessage('Unable to subscribe. Please try again.'); }
  };

  if (status === 'success') return <div className={`${compact ? 'py-4' : 'py-8'} text-center`}><p className={`font-medium ${dark ? 'text-white' : 'text-green-700'}`}>{message}</p></div>;

  return (
    <div className={compact ? '' : 'p-8 sm:p-12 text-center'}>
      <h3 className={`font-semibold ${compact ? 'text-lg' : 'text-2xl'} mb-2 ${dark ? 'text-white' : 'text-accent'}`}>{title}</h3>
      <p className={`text-sm mb-6 max-w-md mx-auto ${dark ? 'text-white/60' : 'text-gray-500'}`}>{subtitle}</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm focus:outline-none ${dark ? 'bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-white/40' : 'border border-gray-200 focus:border-accent'}`} />
        <button type="submit" disabled={status === 'loading'}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${dark ? 'bg-white text-accent hover:bg-white/90' : 'bg-accent text-white hover:bg-accent-light'}`}>
          {status === 'loading' ? 'Joining...' : ctaText}
        </button>
      </form>
      {status === 'error' && <p className="text-red-400 text-sm mt-3">{message}</p>}
      <p className={`text-[11px] mt-4 ${dark ? 'text-white/30' : 'text-gray-400'}`}>No spam. Unsubscribe anytime.</p>
    </div>
  );
}

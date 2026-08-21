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

  if (status === 'success') return <div className={`${compact ? 'py-6' : 'py-10'} text-center`}><p className={`text-sm font-medium ${dark ? 'text-white' : 'text-green-700'}`}>{message}</p></div>;

  return (
    <div className={compact ? '' : 'py-10 sm:py-14 text-center'}>
      <h3 className={`font-semibold ${compact ? 'text-lg' : 'text-xl sm:text-2xl'} ${dark ? 'text-white' : 'text-accent'} tracking-tight`}>{title}</h3>
      <p className={`text-[13px] mt-2 mb-6 max-w-sm mx-auto leading-relaxed ${dark ? 'text-white/50' : 'text-gray-400'}`}>{subtitle}</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
          className={`flex-1 px-4 py-2.5 rounded-lg text-[13px] focus:outline-none transition-colors ${dark ? 'bg-white/[0.08] border border-white/[0.12] text-white placeholder-white/30 focus:border-white/30' : 'border border-gray-200 focus:border-accent'}`} />
        <button type="submit" disabled={status === 'loading'}
          className={`px-7 py-2.5 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 ${dark ? 'bg-white text-accent hover:bg-white/90' : 'bg-accent text-white hover:bg-accent-light'}`}>
          {status === 'loading' ? 'Joining...' : ctaText}
        </button>
      </form>
      {status === 'error' && <p className="text-red-400 text-[12px] mt-3">{message}</p>}
      <p className={`text-[10px] mt-4 ${dark ? 'text-white/20' : 'text-gray-300'}`}>No spam. Unsubscribe anytime.</p>
    </div>
  );
}

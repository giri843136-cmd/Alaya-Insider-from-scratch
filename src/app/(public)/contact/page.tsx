'use client';

import { useState } from 'react';
import Breadcrumbs from '@/components/public/Breadcrumbs';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', reason: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [responseMsg, setResponseMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setResponseMsg(data.message);
      } else {
        setStatus('error');
        setResponseMsg(data.error);
      }
    } catch {
      setStatus('error');
      setResponseMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="max-w-narrow mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Contact' }]} />
      <h1 className="text-3xl font-semibold text-accent mb-2">Contact Us</h1>
      <p className="text-gray-500 mb-8">Have a question or suggestion? We would love to hear from you.</p>

      {status === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800 font-medium">{responseMsg}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
            <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Reason</label>
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-accent">
              <option value="">Select a reason</option>
              <option value="general">General Inquiry</option>
              <option value="product">Product Question</option>
              <option value="partnership">Partnership / Business</option>
              <option value="feedback">Feedback</option>
              <option value="correction">Content Correction</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Message *</label>
            <textarea required rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent resize-none" />
          </div>
          {status === 'error' && <p className="text-red-600 text-sm">{responseMsg}</p>}
          <button type="submit" disabled={status === 'loading'}
            className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-50">
            {status === 'loading' ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
}

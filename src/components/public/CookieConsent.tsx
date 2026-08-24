'use client';

import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-600">
            We use cookies to improve your experience and analyze site traffic. By clicking &quot;Accept&quot;, you agree to our use of cookies.
            {' '}
            <a href="/cookie-policy" className="underline text-accent hover:text-accent-light">Learn more</a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/privacy-policy" className="text-sm text-gray-500 hover:text-accent transition-colors">
            Privacy Policy
          </a>
          <button
            onClick={accept}
            className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

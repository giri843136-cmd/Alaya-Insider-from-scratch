'use client';

import type { ReactNode } from 'react';

/**
 * FIX I — the comparison-page CTA as a tiny client component.
 *
 * The inline onClick click-beacon used to sit directly on anchors inside the
 * /compare/[slug] SERVER component, which made every published comparison
 * render 500 with "Event handlers cannot be passed to Client Component
 * props". This component owns the anchor (and the beacon) on the client;
 * markup and behaviour are unchanged: a direct Amazon anchor (never /go/),
 * target=_blank, rel="noopener noreferrer nofollow sponsored", and the
 * beacon fires on CLICK only (not on view).
 */
export default function CtaLink({
  href,
  productId,
  destinationType,
  store,
  className,
  children,
}: {
  href: string;
  productId: string;
  destinationType: 'global' | 'india';
  store: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      onClick={() => {
        try {
          fetch('/api/clicks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, destination_type: destinationType, store }),
          });
        } catch {
          /* best effort */
        }
      }}
      className={className}
    >
      {children}
    </a>
  );
}

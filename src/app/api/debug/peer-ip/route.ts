import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, IP_UNTRUSTABLE } from '@/lib/rate-limit';

/**
 * FIX G (b) — DEBUG-ONLY peer/XFF echo for proving what the edge chain does.
 *
 * Returns 404 unless DEBUG_IP=1 is set in the environment (it must never be
 * enabled in normal production; it echoes only header/connection metadata,
 * never cookies, auth state or any secret). Also disabled during `next build`
 * pre-renders so it can never be statically baked.
 *
 * Purpose: run the two RUNBOOK curls against https://alayainsider.com —
 *   1) with a spoofed X-Forwarded-For header, 2) without one — and compare:
 *   - "resolved": "IP_UNTRUSTABLE"  → the header SURVIVED to the app, i.e.
 *     the edge APPENDS/passes XFF (getClientIP correctly rejected the chain).
 *   - "resolved": the address nginx saw (no XFF in the response at all) →
 *     the edge OVERWRITES XFF and the per-IP lockout is safe to trust.
 */
export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  if (process.env.DEBUG_IP !== '1' || process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const xff = req.headers.get('x-forwarded-for');
  const resolved = getClientIP(req);

  return NextResponse.json(
    {
      // What getClientIP resolved for this request (IP_UNTRUSTABLE = header
      // missing, multi-element, or unparseable — see rate-limit.ts).
      resolved,
      untrustable: resolved === IP_UNTRUSTABLE,
      // Raw edge headers, first-hop last (read bottom-up):
      headers: {
        'x-forwarded-for': xff,
        'x-real-ip': req.headers.get('x-real-ip'),
        host: req.headers.get('host'),
        via: req.headers.get('via'),
        'cf-ipcountry': req.headers.get('cf-ipcountry'),
      },
      verdict: xff
        ? xff.includes(',')
          ? 'XFF header arrived with MULTIPLE elements — the edge did NOT overwrite it (append/pass-through); per-IP values are attacker-influenceable.'
          : 'XFF header arrived as a single element — consistent with the edge overwriting it (or the chain being stripped); verify against the spoofed-XFF curl.'
        : 'No XFF header arrived — the edge stripped/overwrote it away entirely; per-IP lockout cannot key on the real client IP from headers.',
      note: 'Debug route (DEBUG_IP=1). Disable on the VPS after use: remove DEBUG_IP and restart.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

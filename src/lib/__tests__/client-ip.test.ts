/**
 * TASK 2 FIX D — getClientIP must reject client-injected X-Forwarded-For
 * chains. With the new nginx config (`proxy_set_header X-Forwarded-For
 * $remote_addr`), a conforming request carries EXACTLY ONE element; any
 * multi-element header means the client's spoofed chain survived to the app.
 */

import { getClientIP, IP_UNTRUSTABLE } from '../rate-limit';

function reqWithHeaders(headers: Record<string, string>): Request {
  return new Request('https://alayainsider.com/api/auth/login', {
    method: 'POST',
    headers,
  });
}

describe('getClientIP (FIX D multi-element rejection)', () => {
  it('X-Forwarded-For: 8.8.8.8,1.2.3.4  → IP_UNTRUSTABLE (spoofed chain rejected)', () => {
    const req = reqWithHeaders({ 'x-forwarded-for': '8.8.8.8,1.2.3.4' });
    expect(getClientIP(req)).toBe(IP_UNTRUSTABLE);
  });

  it('X-Forwarded-For: 8.8.8.8, 1.2.3.4 (spaces) → IP_UNTRUSTABLE too', () => {
    const req = reqWithHeaders({ 'x-forwarded-for': '8.8.8.8, 1.2.3.4' });
    expect(getClientIP(req)).toBe(IP_UNTRUSTABLE);
  });

  it('X-Forwarded-For: 8.8.8.8,1.2.3.4,10.0.0.1 (3 hops) → IP_UNTRUSTABLE', () => {
    const req = reqWithHeaders({ 'x-forwarded-for': '8.8.8.8,1.2.3.4,10.0.0.1' });
    expect(getClientIP(req)).toBe(IP_UNTRUSTABLE);
  });

  it('X-Forwarded-For: <single real client IP> → that IP (nginx-overwritten header)', () => {
    const req = reqWithHeaders({ 'x-forwarded-for': '198.51.100.7' });
    expect(getClientIP(req)).toBe('198.51.100.7');
  });

  it('single valid IPv6 element is accepted', () => {
    const req = reqWithHeaders({ 'x-forwarded-for': '2001:db8::1' });
    expect(getClientIP(req)).toBe('2001:db8::1');
  });

  it('single garbage element → IP_UNTRUSTABLE (not parsed, not trusted)', () => {
    const req = reqWithHeaders({ 'x-forwarded-for': 'not-an-ip' });
    expect(getClientIP(req)).toBe(IP_UNTRUSTABLE);
  });

  it('missing header → IP_UNTRUSTABLE', () => {
    const req = reqWithHeaders({});
    expect(getClientIP(req)).toBe(IP_UNTRUSTABLE);
  });

  it('X-Real-IP is never trusted, even alone (FIX B regression guard)', () => {
    const req = reqWithHeaders({ 'x-real-ip': '6.6.6.6' });
    expect(getClientIP(req)).toBe(IP_UNTRUSTABLE);
  });
});

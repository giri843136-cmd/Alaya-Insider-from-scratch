/**
 * OneLink snippet handling.
 *
 * Amazon OneLink is a JS widget that rewrites product anchors pointing at
 * Amazon marketplaces to the visitor's local store (with the -20 tag for the
 * 9 secondary markets). Its snippet is pasted by the admin from the US
 * Associates account (Account Settings → OneLink) and injected once into the
 * root layout.
 *
 * SECURITY: we never inject arbitrary HTML/JS. Only `<script src=...>` tags
 * whose src host is an Amazon-owned domain are accepted; every other tag,
 * inline script body or unexpected host is rejected. The raw snippet is stored
 * in the DB for status display, but ONLY the extracted, validated src URLs are
 * ever rendered (via next/script).
 */

// OneLink is delivered from amazon-adsystem.com subdomains (z-*, ws-*, aax-*)
// and may reference other Amazon hosts. Per the integration rules we accept:
//   *.amazon-adsystem.com, *.amazon.com, *.amazon.co.uk  (and the bare domains)
const ALLOWED_HOST_RE = /(^|\.)(amazon-adsystem\.com|amazon\.com|amazon\.co\.uk)$/i;

export interface OneLinkValidation {
  ok: boolean;
  srcs: string[];
  error?: string;
}

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/** Extract the src attribute value from a script tag's attributes string. */
function srcOf(attrs: string): string {
  const m = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return '';
  return (m[2] || m[3] || m[4] || '').trim();
}

function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\./, '');
  return ALLOWED_HOST_RE.test(h);
}

/** Validate a pasted OneLink snippet. Returns the safe external src URLs. */
export function validateOneLinkSnippet(snippet: string): OneLinkValidation {
  const raw = (snippet || '').trim();
  if (!raw) return { ok: false, srcs: [], error: 'Paste the OneLink JavaScript snippet first.' };

  // Reject anything that is not pure <script> tags (no iframes, no inline
  // markup, no arbitrary HTML that could smuggle code in).
  const trimmed = raw.replace(/^\s+|\s+$/g, '');
  const nonScript = trimmed.replace(SCRIPT_RE, '');
  if (nonScript.trim()) {
    return { ok: false, srcs: [], error: 'The snippet may only contain <script> tags — no other HTML is accepted.' };
  }

  const srcs: string[] = [];
  let match: RegExpExecArray | null;
  SCRIPT_RE.lastIndex = 0;
  while ((match = SCRIPT_RE.exec(raw)) !== null) {
    const attrs = match[1] || '';
    const body = (match[2] || '').trim();
    const src = srcOf(attrs);

    // Inline script bodies are never allowed — OneLink ships as external src.
    if (body) {
      return { ok: false, srcs: [], error: 'Inline script bodies are not allowed — OneLink must be an external <script src="..."> tag.' };
    }
    if (!src) {
      return { ok: false, srcs: [], error: 'Every <script> tag must have a src attribute.' };
    }
    if (!/^https:\/\//i.test(src)) {
      return { ok: false, srcs: [], error: 'Script src must use https:// — found: ' + src.slice(0, 80) };
    }
    let host: string;
    try {
      host = new URL(src).hostname;
    } catch {
      return { ok: false, srcs: [], error: 'Invalid script src URL: ' + src.slice(0, 80) };
    }
    if (!isAllowedHost(host)) {
      return { ok: false, srcs: [], error: `Script host "${host}" is not an Amazon-owned domain. Only *.amazon-adsystem.com, *.amazon.com and *.amazon.co.uk are accepted.` };
    }
    srcs.push(src);
  }

  if (srcs.length === 0) {
    return { ok: false, srcs: [], error: 'No <script src="..."> tags found in the snippet.' };
  }
  return { ok: true, srcs };
}

/** The site_settings key holding the admin-pasted OneLink snippet. */
export const ONELINK_SETTING_KEY = 'onelink_snippet';

export function readOneLinkSnippet(getSetting: (k: string) => string): string {
  try {
    return getSetting(ONELINK_SETTING_KEY) || '';
  } catch {
    return '';
  }
}
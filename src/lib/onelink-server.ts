/**
 * Server-side OneLink helper for the root layout.
 *
 * Reads the admin-pasted snippet from site_settings, re-validates it with the
 * same strict sanitizer the API uses, and returns ONLY the approved external
 * script src URLs (never raw HTML/JS). When nothing valid is stored this
 * returns [] and the layout renders no OneLink script.
 */
import getDb from './db';
import { validateOneLinkSnippet, ONELINK_SETTING_KEY } from './onelink';

export function getOneLinkSrcs(): string[] {
  try {
    const row = getDb().prepare('SELECT value FROM site_settings WHERE key = ?').get(ONELINK_SETTING_KEY) as any;
    const snippet = row?.value || '';
    if (!snippet) return [];
    const v = validateOneLinkSnippet(snippet);
    return v.ok ? v.srcs : [];
  } catch {
    return [];
  }
}
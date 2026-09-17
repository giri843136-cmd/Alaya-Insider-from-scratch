/**
 * AUTH_SECRET guard (TASK 2 FIX A).
 *
 * The old code fell back to a hard-coded string ('dev-only-insecure-secret-…')
 * that is public in this repository — anyone could forge an admin session
 * cookie with it. There is deliberately NO default value here anymore:
 *
 *   - NODE_ENV=production and AUTH_SECRET unset/blank → THROW. Called at
 *     module load from both src/middleware.ts and src/lib/auth.ts, so the
 *     process refuses to serve before it can sign or verify sessions.
 *   - Any other environment (dev, tests) → the dev-only sentinel, loudly
 *     warned, so local development still works out of the box.
 *
 * `next build` also runs with NODE_ENV=production; the NEXT_PHASE escape
 * (set by Next itself during builds) keeps `npm run build` from requiring
 * the secret on machines where only the build runs. The runtime process
 * (`next start` under PM2) has no NEXT_PHASE and still hard-fails.
 */

/** Dev/test-only sentinel. NEVER valid in production — see getAuthSecret. */
export const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;

  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error(
      'AUTH_SECRET is not set but NODE_ENV is production — refusing to start. ' +
        'Generate one on the VPS with: openssl rand -base64 48  ' +
        'then add AUTH_SECRET=<value> to the project .env and restart the app (see RUNBOOK.md).',
    );
  }

  console.warn('[auth] AUTH_SECRET not set — using the dev-only insecure fallback. Never run production like this.');
  return DEV_FALLBACK_SECRET;
}

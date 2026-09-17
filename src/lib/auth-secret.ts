/**
 * AUTH_SECRET guard (TASK 2 FIX A + FIX E).
 *
 * The old code fell back to a hard-coded string ('dev-only-insecure-secret-…')
 * that is public in this repository — anyone could forge an admin session
 * cookie with it. There is deliberately NO default value here anymore:
 *
 *   - FIX A: NODE_ENV=production and AUTH_SECRET unset/blank → THROW. Called
 *     at module load from both src/middleware.ts and src/lib/auth.ts, so the
 *     process refuses to serve before it can sign or verify sessions.
 *   - FIX E: NODE_ENV alone is NOT the gate. A process started to SERVE
 *     (next start, or the next-server/render worker it spawns) hard-fails
 *     without a secret even when NODE_ENV is unset or non-standard
 *     (NODE_ENV=test next start used to slip through the FIX A guard).
 *   - Any other environment (dev, tests) → the dev-only sentinel, loudly
 *     warned, so local development still works out of the box.
 *
 * Grounded in this exact Next.js version (16.3.2), not guessed:
 *   - `next start` forces NODE_ENV='production'
 *     (node_modules/next/dist/bin/next: `defaultEnv = commandName === 'dev'
 *     ? 'development' : 'production'`, applied unconditionally before boot).
 *   - `next build` runs with NODE_ENV=production AND sets
 *     process.env.NEXT_PHASE='phase-production-build'
 *     (node_modules/next/dist/build/index.js). Builds never sign or verify
 *     sessions, so they may proceed without a secret.
 *   - `next dev` sets neither a production NODE_ENV nor a NEXT_PHASE env var
 *     (it only names a trace phase, not process.env.NEXT_PHASE).
 * isServingProcess() recognises a serve by argv so the guard stays correct
 * even when someone serves with a non-standard NODE_ENV.
 */

/** Dev/test-only sentinel. NEVER valid in production — see getAuthSecret. */
export const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';

/**
 * True when this process was started to SERVE traffic (`next start`, or the
 * next-server / render-worker process Next spawns for it) — regardless of
 * NODE_ENV. `next dev` never matches (argv carries `dev`); jest and other
 * tooling carry neither marker.
 */
export function isServingProcess(argv: string[] = process.argv): boolean {
  // `next build` runs with NODE_ENV=production but is not a serve — and it
  // announces itself via NEXT_PHASE. Keep builds working secret-less.
  if (process.env.NEXT_PHASE === 'phase-production-build') return false;
  const joined = argv.join(' ');
  // Render/server worker processes Next spawns for a serve.
  if (/next-server\.(js|cjs|mjs)(\s|$)/.test(joined)) return true;
  if (/render-worker\.(js|cjs|mjs)(\s|$)/.test(joined)) return true;
  // The CLI invocation itself: `node .../next/dist/bin/next start` (also how
  // `npm run start` and the pm2 ProcessContainer land here), including the
  // `/bin/sh -c 'next start'` wrapper form. `next` may arrive path-anchored
  // (…/bin/next) or bare after a space (sh -c), so accept both anchors.
  return (
    /(^|[\\/\s])next(\s|$)/.test(joined) && /(^|\s)start(\s|$)/.test(joined)
  );
}

/**
 * FIX E belt-and-braces: refuse session verification from a serving process
 * that somehow ended up on the dev sentinel (e.g. the secret was unset at
 * module load of a differently-configured bundle). Call this at the top of
 * every verify path (src/lib/auth.ts verifyToken, src/middleware.ts).
 */
export function assertUsableSessionSecret(secret: string, argv: string[] = process.argv): void {
  if (secret === DEV_FALLBACK_SECRET && isServingProcess(argv)) {
    throw new Error(
      '[auth] refusing to verify sessions: this serving process is on the dev-only fallback secret. ' +
        'Set AUTH_SECRET in the project .env and restart (see RUNBOOK.md).',
    );
  }
}

export function getAuthSecret(argv: string[] = process.argv): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;

  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  // FIX E: serving without a secret is fatal no matter what NODE_ENV says.
  // (In practice `next start` forces NODE_ENV=production, so the FIX A branch
  // below fires for the normal serve; this one catches non-standard NODE_ENV.)
  if (!isBuildPhase && isServingProcess(argv)) {
    throw new Error(
      `AUTH_SECRET is not set but this process is serving traffic (NODE_ENV=${process.env.NODE_ENV || '(unset)'}) ` +
        '— refusing to start. Generate one on the VPS with: openssl rand -base64 48 ' +
        'then add AUTH_SECRET=<value> to the project .env and restart the app (see RUNBOOK.md).',
    );
  }

  // FIX A: production + no secret → hard fail (no default value, ever).
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error(
      'AUTH_SECRET is not set but NODE_ENV is production — refusing to start. ' +
        'Generate one on the VPS with: openssl rand -base64 48 ' +
        'then add AUTH_SECRET=<value> to the project .env and restart the app (see RUNBOOK.md).',
    );
  }

  if (isBuildPhase) {
    console.warn('[auth] AUTH_SECRET not set during build — build proceeds without a signing secret.');
  } else {
    console.warn('[auth] AUTH_SECRET not set — using the dev-only insecure fallback. Never run production like this.');
  }
  return DEV_FALLBACK_SECRET;
}

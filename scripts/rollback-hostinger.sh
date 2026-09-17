#!/usr/bin/env bash
#
# TASK 28 — Hostinger rollback runner (run ON the VPS, from the app root).
#
#   ./scripts/rollback-hostinger.sh          # interactive (confirm before acting)
#   ./scripts/rollback-hostinger.sh --auto   # used by deploy-hostinger.sh (g)
#
# What it does:
#   1. reads the previous sha from data/backups/last-deploy.txt
#      (written by deploy-hostinger.sh before any swap; data/backups/ is
#      gitignored, so it never dirties `git status`)
#   2. git checkout <previous-sha> (never reset --hard, never clean)
#   3. pm2 restart <appname> --update-env && pm2 save
#   4. re-runs the 200 / 302 / 401 smoke checks
#   5. documents the DB restore line (cp data/backups/<file> data/alaya.db)
#      as a step YOU must confirm with a typed 'YES' — never executed
#      automatically by this script
#
# This script never touches .env, never edits src/, never pushes anywhere.

set -uo pipefail

APP_NAME="alayainsider"
SITE="https://alayainsider.com"
STATE_FILE="data/backups/last-deploy.txt"

echo "==================================================================="
echo " TASK 28 rollback — $(date -u +'%Y-%m-%d %H:%M:%SZ')"
echo "==================================================================="

# ── 1) State file ───────────────────────────────────────────────────────────
if [ ! -f "$STATE_FILE" ]; then
  echo "ERROR: $STATE_FILE not found — no rollback point recorded by deploy-hostinger.sh." >&2
  exit 2
fi
STATE="$(cat "$STATE_FILE")"
PREV_SHA="${STATE%%|*}"
DEPLOYED_SHA="${STATE##*|}"
if ! [[ "$PREV_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: invalid previous sha '$PREV_SHA' in $STATE_FILE." >&2
  exit 2
fi

echo "   rollback point : $PREV_SHA (currently deployed: ${DEPLOYED_SHA:-unknown})"

# ── Confirmation (skipped only for --auto from the deploy script) ──────────
if [ "${1:-}" != "--auto" ]; then
  if [ -t 0 ]; then
    read -r -p "Type YES to check out $PREV_SHA and restart $APP_NAME: " ans
    [ "$ans" = "YES" ] || { echo "Aborted — nothing changed."; exit 1; }
  else
    echo "Refusing to run non-interactively without --auto (nothing changed)."
    exit 1
  fi
fi

# ── 2) Checkout the previous sha ────────────────────────────────────────────
git checkout "$PREV_SHA" || { echo "ERROR: git checkout $PREV_SHA failed — current build left in place." >&2; exit 1; }
echo "   checked out: $PREV_SHA"

# The previous sha needs its build artifacts; the deploy script only built
# the NEW sha. Build what we just checked out before restarting. Re-run
# npm ci ONLY when the dependency tree actually differs between the two
# shas — otherwise node_modules already matches and ci would just burn time.
if git diff --name-only "${DEPLOYED_SHA:-HEAD}" "$PREV_SHA" -- package.json package-lock.json 2>/dev/null | grep -q .; then
  echo "   dependency tree changed between shas — running npm ci..."
  npm ci || { echo "ERROR: npm ci failed on the rollback sha — fix and re-run." >&2; exit 1; }
else
  echo "   dependency tree unchanged — skipping npm ci"
fi
echo "   building the rollback sha..."
npm run build || { echo "ERROR: build of the rollback sha failed — pm2 still serves whatever was last built; run 'npm ci && npm run build' manually." >&2; exit 1; }

# ── 3) Restart ──────────────────────────────────────────────────────────────
pm2 restart "$APP_NAME" --update-env || { echo "ERROR: pm2 restart failed — inspect 'pm2 logs $APP_NAME'." >&2; exit 1; }
pm2 save
echo "   pm2 restarted and saved"
sleep 3

# ── 4) Smoke checks: 200 / 302 / 401 only ──────────────────────────────────
echo "-- smoke checks against $SITE"
SMOKE_FAIL=0
HOME_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/")"
if [ "$HOME_CODE" = "200" ]; then echo "PASS  HOME / -> 200"; else echo "FAIL  HOME / -> expected 200, got $HOME_CODE"; SMOKE_FAIL=1; fi

ADMIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/admin/products")"
if [ "$ADMIN_CODE" = "302" ]; then echo "PASS  /admin/products -> 302"; else echo "FAIL  /admin/products -> expected 302, got $ADMIN_CODE"; SMOKE_FAIL=1; fi

ADMINAPI_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/admin/products")"
if [ "$ADMINAPI_CODE" = "401" ]; then echo "PASS  /api/admin/products -> 401"; else echo "FAIL  /api/admin/products -> expected 401, got $ADMINAPI_CODE"; SMOKE_FAIL=1; fi

# ── 5) DB restore: DOCUMENTED, NEVER auto-executed ─────────────────────────
echo ""
echo "==================================================================="
echo " DB RESTORE — MANUAL STEP (required only if the failed deploy"
echo " corrupted the DB, e.g. a half-run of scripts/NULL-commercial-fields.ts):"
echo ""
echo "   1. stop traffic:            pm2 stop $APP_NAME"
echo "   2. confirm current state:   ls -lt data/backups/alaya-*.pre-deploy.db"
echo "   3. restore:                 cp data/backups/<file> data/alaya.db"
echo "      (replacing <file> with the newest pre-deploy backup —"
echo "       type YES when you are sure; this overwrites data/alaya.db)"
echo "   4. restart:                 pm2 restart $APP_NAME --update-env"
echo ""
echo " The deploy/rollback scripts NEVER run this for you."
echo "==================================================================="

if [ "$SMOKE_FAIL" -eq 1 ]; then
  echo " ROLLBACK SMOKE CHECKS FAILED — the previous sha is checked out but"
  echo " something else is wrong. Inspect 'pm2 logs $APP_NAME --lines 100'."
  exit 1
fi

echo " ROLLBACK OK — previous sha live, 200/302/401 smoke checks pass."
exit 0

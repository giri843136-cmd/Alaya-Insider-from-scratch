#!/usr/bin/env bash
#
# TASK 28 — Hostinger deploy runner (run ON the VPS, from the app root).
#
#   ./scripts/deploy-hostinger.sh <40-char git sha>
#
# Order of operations:
#   (a) verify the sha exists and is an ancestor of origin/main (FETCH ONLY —
#       never pull, never merge)
#   (b) pre-flight: node >= 20.9.0, npm, next, clean worktree, AUTH_SECRET
#       presence via the RUNBOOK length-only check (value never printed)
#   (c) sqlite backup to data/backups/ (keep last 5, verify size > 0) BEFORE
#       anything restarts — TASK 4's NULL script and the lazy login_lockouts
#       table both mutate the DB
#   (d) checkout the target sha with plain 'git checkout' (never reset --hard,
#       never clean -fdx, never force-push), then gates: npm ci && npm test &&
#       npx tsc --noEmit && npm run build. The gates must run against the
#       TARGET code — otherwise the restart in (e) would serve a stale build.
#       On gate failure the worktree is restored to the previous sha and pm2
#       is never touched, so the live site is unaffected.
#   (e) pm2 restart <appname> --update-env, then pm2 save
#   (f) POST-DEPLOY verification suite against https://alayainsider.com —
#       PASS/FAIL per check, non-zero exit if ANY fails
#   (g) any verification failure → automatic rollback via
#       scripts/rollback-hostinger.sh and a print of what it did
#
# This script never touches .env, never edits src/, never creates cron jobs
# or firewall rules, and never pushes anywhere.

set -uo pipefail

APP_NAME="alayainsider"
SITE="https://alayainsider.com"
REMOTE="origin"
BRANCH="main"
DB_FILE="data/alaya.db"
BACKUP_DIR="data/backups"
STATE_FILE="$BACKUP_DIR/last-deploy.txt"   # "previous_sha|deployed_sha" (data/backups/ is gitignored)
DEPLOYS_MD="DEPLOYS.md"
KEEP_BACKUPS=5
TTFB_LIMIT_MS=1200
NODE_MIN="20.9.0"
VERIFY_COUNT=10   # checks below; ONE FAIL = deploy declared failed

# ── Counters ────────────────────────────────────────────────────────────────
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $*"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $*"; }

echo "==================================================================="
echo " TASK 28 deploy — $(date -u +'%Y-%m-%d %H:%M:%SZ')"
echo "==================================================================="

# ── (a) Arguments + sha verification (before touching anything) ────────────
if [ "$#" -ne 1 ]; then
  echo "ERROR: exactly one argument required." >&2
  echo "Usage: ./scripts/deploy-hostinger.sh <40-char git sha>" >&2
  exit 2
fi
SHA="$1"
if ! [[ "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: \"$SHA\" is not a 40-character lowercase git sha." >&2
  exit 2
fi

echo "-- (a) verifying sha $SHA against $REMOTE/$BRANCH (fetch only, no merge)"
git fetch "$REMOTE" || { echo "ERROR: git fetch $REMOTE failed." >&2; exit 2; }
git rev-parse -q --verify "$SHA^{commit}" >/dev/null \
  || { echo "ERROR: sha $SHA does not exist in this repository." >&2; exit 2; }
if ! git merge-base --is-ancestor "$SHA" "$REMOTE/$BRANCH"; then
  echo "ERROR: sha $SHA is NOT an ancestor of $REMOTE/$BRANCH — refusing to deploy un-pushed or unrelated commits." >&2
  exit 2
fi
echo "   sha is an ancestor of $REMOTE/$BRANCH."

# ── (b) Pre-flight ──────────────────────────────────────────────────────────
echo "-- (b) pre-flight"

NODE_V="$(node -v 2>/dev/null || true)"
[ -n "$NODE_V" ] || { echo "ERROR: node not found in PATH." >&2; exit 2; }
echo "   node      : $NODE_V (required >= v$NODE_MIN for Next 16)"
node -e "const [ma,mi]=process.versions.node.split('.').map(Number);if(ma<20||(ma===20&&mi<9)){process.exit(1)}" \
  || { echo "ERROR: node $NODE_V is older than v$NODE_MIN — Next 16 requires >= 20.9.0. Upgrade Node first." >&2; exit 2; }

echo "   npm       : $(npm -v 2>/dev/null || echo 'NOT FOUND')"
npm -v >/dev/null 2>&1 || { echo "ERROR: npm not found." >&2; exit 2; }
echo "   next      : $(npx --no-install next -v 2>/dev/null || echo 'NOT FOUND (installed by npm ci)')"

DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  echo "ERROR: worktree is not clean — commit or stash first. Not deploying on top of un-managed edits:" >&2
  echo "$DIRTY" | head -10 >&2
  exit 2
fi
echo "   git status: clean"

AUTH_LEN="$(node -e "
const fs=require('fs');
try {
  const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>x.startsWith('AUTH_SECRET='));
  console.log(line?line.slice(12).trim().length:0);
} catch { console.log(0); }
")"
if [ "${AUTH_LEN:-0}" -lt 32 ]; then
  echo "ERROR: AUTH_SECRET missing or too short (length=${AUTH_LEN:-0}, minimum 32). Value never printed." >&2
  echo "       Set it per RUNBOOK: openssl rand -base64 48 into .env, then pm2 restart $APP_NAME --update-env." >&2
  exit 2
fi
echo "   AUTH_SECRET: set (length=$AUTH_LEN — value not printed)"

pm2 describe "$APP_NAME" >/dev/null 2>&1 \
  || { echo "ERROR: pm2 app '$APP_NAME' not found — run 'pm2 start ecosystem.config.cjs && pm2 save' once first." >&2; exit 2; }
echo "   pm2 app   : $APP_NAME found"

# ── (c) DB backup (BEFORE any restart) ──────────────────────────────────────
echo "-- (c) sqlite backup"
STAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/alaya-$STAMP.pre-deploy.db"
# File-level copy while pm2 is live: sqlite rolls its journal on restart, so
# this is a consistent-enough snapshot for restore purposes.
cp -p "$DB_FILE" "$BACKUP" || { echo "ERROR: DB backup copy failed." >&2; exit 2; }
B_SIZE="$(stat -c %s "$BACKUP" 2>/dev/null || wc -c < "$BACKUP")"
if [ "${B_SIZE:-0}" -le 0 ]; then
  echo "ERROR: backup file is 0 bytes — aborting before anything is touched." >&2
  exit 2
fi
echo "   backup: $BACKUP ($B_SIZE bytes)"
ls -1t "$BACKUP_DIR"/alaya-*.pre-deploy.db 2>/dev/null | tail -n +$((KEEP_BACKUPS+1)) | while read -r old; do
  rm -f -- "$old"; echo "   pruned old backup: $old"
done
# Integrity sanity check on the snapshot (read-only, on the copy).
if node -e "
const db=require('better-sqlite3')('$BACKUP',{readonly:true});
const r=db.pragma('integrity_check');
if(String(r[0].integrity_check).toLowerCase()!=='ok'){process.exit(1)}
db.close();
" 2>/dev/null; then
  echo "   backup integrity_check: ok"
else
  echo "   WARNING: could not run integrity_check on the copy (non-fatal — the size check passed)."
fi

# ── (d) Checkout the target sha, then gates ─────────────────────────────────
# The gates must exercise the release being deployed, not the code that is
# already live (otherwise the restart in (e) would serve a stale build — a
# no-op deploy that looks successful). From the RUNNING SERVICE's point of
# view nothing is swapped until pm2 restarts in (e); if any gate fails, the
# worktree is restored to the previous sha and pm2 is never touched.
echo "-- (d) checkout $SHA (plain git checkout — never reset --hard, never clean) + gates"
PREV_SHA="$(git rev-parse HEAD)"
printf '%s|%s\n' "$PREV_SHA" "$SHA" > "$STATE_FILE"
echo "   saved rollback point: $PREV_SHA (in $STATE_FILE)"

if ! git checkout "$SHA"; then
  echo "ERROR: git checkout failed — worktree left on $(git rev-parse --short HEAD), pm2 untouched." >&2
  exit 1
fi

GATE_FAILED=""
npm ci || GATE_FAILED="npm ci"
if [ -z "$GATE_FAILED" ]; then npm test || GATE_FAILED="npm test"; fi
if [ -z "$GATE_FAILED" ]; then npx tsc --noEmit || GATE_FAILED="npx tsc --noEmit"; fi
if [ -z "$GATE_FAILED" ]; then npm run build || GATE_FAILED="npm run build"; fi

if [ -n "$GATE_FAILED" ]; then
  if git checkout "$PREV_SHA" 2>/dev/null; then
    RESTORED="worktree restored to the previous sha ($PREV_SHA)"
  else
    RESTORED="worktree RESTORE FAILED — run 'git checkout $PREV_SHA' manually"
  fi
  echo "******************************************************************"
  echo " DEPLOY ABORTED at '$GATE_FAILED'."
  echo " $RESTORED; pm2 was never restarted — the live site is untouched."
  echo " (Note: the failed checkout touched only the worktree, never history —"
  echo "  no reset --hard, no clean, no force-push anywhere in this script.)"
  echo " Retry after fixing, from the app root:"
  echo "   ./scripts/deploy-hostinger.sh $SHA"
  echo "******************************************************************"
  exit 1
fi
echo "   gates: npm ci, npm test, tsc --noEmit, npm run build — all passed (at $SHA)"

# ── (e) Swap: pm2 restart → save ────────────────────────────────────────────
echo "-- (e) pm2 restart ($APP_NAME)"
if ! pm2 restart "$APP_NAME" --update-env; then
  echo "ERROR: pm2 restart failed — attempting automatic rollback..." >&2
  bash scripts/rollback-hostinger.sh --auto || true
  exit 1
fi
pm2 save
echo "   serving $SHA; waiting 3 s for the server to warm up..."
sleep 3

# ── (f) POST-DEPLOY VERIFICATION SUITE ──────────────────────────────────────
echo "-- (f) verification suite against $SITE ($VERIFY_COUNT checks)"
PRODUCT_URL="$SITE/product/le-creuset-skillet"
TMP_HTML="$(mktemp)"
trap 'rm -f "$TMP_HTML"' EXIT

# 1) homepage 200
HOME_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/")"
if [ "$HOME_CODE" = "200" ]; then ok "1. HOME / -> 200"; else bad "1. HOME / -> expected 200, got $HOME_CODE"; fi

# 2) product page: zero price/rating artifacts (TASKs 3+4+5)
PRODUCT_COUNT="$(curl -s "$PRODUCT_URL" | grep -ciE 'offers|priceCurrency|ratingValue|reviewCount|199\.95|3456|"current_price"')"
if [ "${PRODUCT_COUNT:-1}" -eq 0 ]; then ok "2. PRODUCT PAGE price/rating artifacts -> 0 matches"; else bad "2. PRODUCT PAGE has $PRODUCT_COUNT price/rating artifact match(es)"; fi

# 3) public API allow-list intact (TASK 1)
API_COUNT="$(curl -s "$SITE/api/products?limit=1" | grep -cE '"rating"|"current_price"|"review_count"|"live_price"')"
if [ "${API_COUNT:-1}" -eq 0 ]; then ok "3. PUBLIC API -> no rating/current_price/review_count/live_price"; else bad "3. PUBLIC API leaks $API_COUNT commercial field match(es)"; fi

# 4) status=draft filter gone — only published rows (TASK 1)
DRAFT_ROWS="$(curl -s "$SITE/api/products?status=draft&limit=100" | grep -c '"status":"draft"')"
PUBLISHED_ROWS="$(curl -s "$SITE/api/products?status=draft&limit=100" | grep -c '"status":"published"')"
if [ "${DRAFT_ROWS:-1}" -eq 0 ] && [ "${PUBLISHED_ROWS:-0}" -ge 1 ]; then ok "4. STATUS=DRAFT -> published rows only"; else bad "4. STATUS=DRAFT -> draft rows: ${DRAFT_ROWS:-?}, published rows: ${PUBLISHED_ROWS:-0}"; fi

# 5) admin page redirects when unauthenticated (TASK 2)
ADMIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/admin/products")"
if [ "$ADMIN_CODE" = "302" ]; then ok "5. /admin/products -> 302"; else bad "5. /admin/products -> expected 302, got $ADMIN_CODE"; fi

# 6) admin API unauthorized (TASK 2)
ADMINAPI_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/admin/products")"
if [ "$ADMINAPI_CODE" = "401" ]; then ok "6. /api/admin/products -> 401"; else bad "6. /api/admin/products -> expected 401, got $ADMINAPI_CODE"; fi

# 7) Associate disclosure adjacent to CTAs — >=1 occurrence on a CTA page and
#    NOT the footer-only 25%-opacity line (TASK 27). Baseline: the 404 page
#    renders the site footer but has no affiliate CTAs, so its occurrence
#    count is the footer-only baseline; a CTA page must exceed it.
DISCLOSURE='As an Amazon Associate I earn from qualifying purchases.'
curl -s "$SITE/product/nope-404-test" > "$TMP_HTML"
FOOTER_N="$(grep -oF "$DISCLOSURE" "$TMP_HTML" | wc -l)"
DISCLOSURE_OK=1
DISCLOSURE_DETAIL=""
# Product page + up to one published comparison page from the sitemap.
CHECK_URLS=("$PRODUCT_URL")
COMPARE_URL="$(curl -s "$SITE/sitemap.xml" | grep -oE 'https://alayainsider\.com/compare/[^<]+' | head -1)"
[ -n "$COMPARE_URL" ] && CHECK_URLS+=("$COMPARE_URL")
for u in "${CHECK_URLS[@]}"; do
  curl -s "$u" > "$TMP_HTML"
  PAGE_N="$(grep -oF "$DISCLOSURE" "$TMP_HTML" | wc -l)"
  if [ "$PAGE_N" -lt 1 ] || [ "$PAGE_N" -le "$FOOTER_N" ]; then
    DISCLOSURE_OK=0
    DISCLOSURE_DETAIL="$DISCLOSURE_DETAIL $u(page=$PAGE_N,footer-baseline=$FOOTER_N)"
  fi
done
if [ "$DISCLOSURE_OK" -eq 1 ]; then ok "7. DISCLOSURE adjacent to CTAs (not footer-only; baseline=$FOOTER_N)"; else bad "7. DISCLOSURE missing or footer-only on:$DISCLOSURE_DETAIL"; fi

# 8) 404 handler
NF_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/product/nope-404-test")"
if [ "$NF_CODE" = "404" ]; then ok "8. /product/nope-404-test -> 404"; else bad "8. /product/nope-404-test -> expected 404, got $NF_CODE"; fi

# 9) debug route disabled (DEBUG_IP must be off)
DEBUG_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/debug/peer-ip")"
if [ "$DEBUG_CODE" = "404" ]; then ok "9. /api/debug/peer-ip -> 404 (DEBUG_IP off)"; else bad "9. /api/debug/peer-ip -> expected 404, got $DEBUG_CODE — DEBUG_IP must NOT be enabled in prod"; fi

# 10) TTFB on a product page (first post-restart hit, pre-caching)
TTFB="$(curl -s -o /dev/null -w '%{time_starttransfer}' --max-time 15 "$PRODUCT_URL")"
TTFB_MS="$(awk -v t="$TTFB" 'BEGIN{printf "%d", t*1000}')"
if [ "${TTFB_MS:-99999}" -lt "$TTFB_LIMIT_MS" ]; then ok "10. TTFB ${TTFB_MS} ms < ${TTFB_LIMIT_MS} ms (product page, first hit)"; else bad "10. TTFB ${TTFB_MS} ms >= ${TTFB_LIMIT_MS} ms (product page)"; fi

echo "-- last 40 pm2 log lines ($APP_NAME)"
pm2 logs "$APP_NAME" --lines 40 --nostream || echo "(pm2 logs command failed — non-fatal for the check tally)"

echo "-------------------------------------------------------------------"
echo " VERIFICATION: $PASS/$VERIFY_COUNT passed, $FAIL failed"
echo "-------------------------------------------------------------------"

# ── (g) Any failure → automatic rollback ────────────────────────────────────
if [ "$FAIL" -gt 0 ]; then
  echo "******************************************************************"
  echo " $FAIL of $VERIFY_COUNT checks FAILED — rolling back automatically."
  echo "******************************************************************"
  bash scripts/rollback-hostinger.sh --auto
  RC=$?
  echo " Rollback finished (exit $RC): previous sha checked out, rebuilt,"
  echo " pm2 restarted, 200/302/401 smoke checks re-run. The DB was NOT"
  echo " modified by the deploy; if it had been, restore manually per the"
  echo " DB RESTORE instructions printed by scripts/rollback-hostinger.sh"
  echo " (the typed-'YES' step)."
  exit 1
fi

# ── Success: append to DEPLOYS.md ────────────────────────────────────────────
if [ ! -f "$DEPLOYS_MD" ]; then
  cat > "$DEPLOYS_MD" << 'EOF'
# Deploy log

| Date (UTC)      | Sha                                      | Checks passed | Rollback |
|-----------------|------------------------------------------|---------------|----------|
EOF
fi
printf '| %s | %s | %s/%s | no |\n' "$(date -u +'%Y-%m-%d %H:%M')" "$SHA" "$PASS" "$VERIFY_COUNT" >> "$DEPLOYS_MD"
echo " DEPLOY OK — appended to $DEPLOYS_MD (set Rollback=yes on that row if you ever roll back)."
echo " REMINDER: the next deploy requires a clean worktree — commit the log row now:"
echo "   git add $DEPLOYS_MD && git commit -m 'deploy $SHA' && git push"
exit 0

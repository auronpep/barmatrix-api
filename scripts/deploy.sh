#!/usr/bin/env bash
# Atomic production deploy for barmatrix-api (Hostinger / Passenger).
#
# WHY THIS EXISTS
# ---------------
# Hostinger hPanel Git "auto-deploy" re-clones + rebuilds (tsc) in place on every
# push to main. Passenger can spawn a worker mid-rebuild and read a HALF-WRITTEN
# dist/*.js -> "SyntaxError: Invalid or unexpected token" fatal at ESM entry
# compile (Sentry BARMATRIX-API-2, 2026-06-02). This script removes that race:
# it builds LOCALLY, uploads to a staging dir, then swaps each compiled file into
# place with an atomic rename (mv = rename(2) on the same filesystem), and only
# then restarts. Passenger therefore only ever sees a complete old file or a
# complete new file -- never a partial one.
#
# PRECONDITION (verified 2026-06-03): Hostinger hPanel Git auto-deploy must be
# DISCONNECTED. The recurring ".env gets wiped" failure mode is already retired --
# secrets live in ~/secrets/barmatrix-api.env OUTSIDE the clone dir and config.ts
# reads them there, so a re-clone can no longer break boot. The ONLY remaining
# reason to keep auto-deploy off is the build RACE above. Once it is off, pushing
# to main is pure git provenance (no prod effect) and THIS script is the sole
# deploy path. The [0/6] preflight below auto-detects if auto-deploy is still live
# (server git reflog shows a clone/pull this script never makes) and warns -- so no
# one has to remember this by hand. This script NEVER touches the server .env or DB.
#
# Usage:
#   bash scripts/deploy.sh            # build, upload, atomic swap, restart, verify
#   DRY_RUN=1 bash scripts/deploy.sh  # print what it would do, no remote changes
#
# Overridable env (defaults target current prod):
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/barmatrix_hostinger_20260527_ed25519}"
SSH_PORT="${SSH_PORT:-65002}"
SSH_HOST="${SSH_HOST:-u211961595@191.96.56.130}"
APP_DIR="${APP_DIR:-~/domains/barmatrix.app/nodejs}"
HEALTH_URL="${HEALTH_URL:-https://api.barmatrix.app/health}"
DRY_RUN="${DRY_RUN:-0}"

STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="deploy-stage-${STAMP}"

ssh_run() { ssh -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_HOST" "$@"; }

# [0/6] Preflight: detect whether Hostinger hPanel Git auto-deploy is still live.
# This script NEVER touches the server's .git, so the prod reflog only changes when
# something ELSE rewrites the checkout -- i.e. hPanel Git auto-deploy on a push to
# main. We snapshot the reflog top into a baseline sentinel ($BASELINE) at the end
# of every successful deploy; if it has CHANGED since then, auto-deploy fired and a
# future push can re-race the build. WARN only (non-fatal): this deploy is atomic +
# self-rolling-back and safe regardless. Skip with SKIP_AUTODEPLOY_CHECK=1.
SKIP_AUTODEPLOY_CHECK="${SKIP_AUTODEPLOY_CHECK:-0}"
BASELINE="$APP_DIR/.deploy-reflog-baseline"
reflog_top="$(ssh_run "cd $APP_DIR 2>/dev/null && git reflog --date=iso 2>/dev/null | head -1" || true)"
if [ "$SKIP_AUTODEPLOY_CHECK" != "1" ]; then
  echo "==> [0/6] Preflight: checking prod git reflog vs deploy baseline"
  baseline_top="$(ssh_run "set -e; cd $APP_DIR 2>/dev/null; APP=\$(pwd -P); cat \"\$APP/.deploy-reflog-baseline\" 2>/dev/null" || true)"
  if [ -z "$baseline_top" ]; then
    echo "  No baseline yet (first run of self-audit). Current prod reflog top:"
    echo "       ${reflog_top:-<empty>}"
    echo "  Recording it on success; future runs warn if it changes (= auto-deploy fired)."
  elif [ "$reflog_top" != "$baseline_top" ]; then
    echo "  !! AUTO-DEPLOY LIKELY STILL LIVE -- prod .git changed since last deploy.sh run:"
    echo "       was : $baseline_top"
    echo "       now : $reflog_top"
    echo "  !! deploy.sh never writes .git, so hPanel Git auto-deploy rewrote it (a push"
    echo "     to main re-clones + rebuilds -> transient build-race 503)."
    echo "  !! One-time fix: hPanel -> Websites -> barmatrix.app -> Git -> disconnect the"
    echo "     auto-deploy on auronpep/barmatrix-api. Then push-to-main is safe and this"
    echo "     script is the only deploy path. (Continuing -- this deploy is safe.)"
  else
    echo "  OK: prod .git unchanged since last deploy -- auto-deploy appears OFF/idle."
  fi
fi

echo "==> [1/6] Local build (tsc)"
npm run build

echo "==> [2/6] Verify the built entry + preload parse locally (node --check)"
node --check dist/index.js
node --check dist/app-entry.js
node --check dist/sentry-init.js

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN: would rsync dist/ + package.json to $APP_DIR/$STAGE, atomically swap, restart, verify."
  exit 0
fi

echo "==> [3/6] Upload build to staging dir ($STAGE) on the server"
# Staging keeps the live tree untouched until the atomic swap.
ssh_run "mkdir -p $APP_DIR/$STAGE"
scp -i "$SSH_KEY" -P "$SSH_PORT" -r dist package.json "$SSH_HOST:$APP_DIR/$STAGE/"

echo "==> [4/6] Snapshot current dist for rollback, then atomic-swap each file"
# Resolve the absolute app dir on the REMOTE (APP). A '~' inside double quotes
# does not expand, so all quoted paths below use the absolute \$APP, not \$APP_DIR.
ssh_run "set -e; cd $APP_DIR; APP=\$(pwd -P); \
  cp -r dist dist.bak-${STAMP}; \
  cd \"\$APP/$STAGE/dist\"; \
  find . -type f | while IFS= read -r f; do \
    mkdir -p \"\$APP/dist/\$(dirname \"\$f\")\"; \
    mv -f \"\$f\" \"\$APP/dist/\$f\"; \
  done; \
  cd \"\$APP\"; cp -f \"\$APP/$STAGE/package.json\" package.json; rm -rf \"\$APP/$STAGE\""

echo "==> [5/6] Restart Passenger (touch restart marker)"
ssh_run "set -e; cd $APP_DIR; APP=\$(pwd -P); mkdir -p \"\$APP/tmp\"; touch \"\$APP/tmp/restart.txt\""

echo "==> [6/6] Health check"
ok=0
for i in 1 2 3 4 5 6; do
  sleep 5
  code="$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  echo "  attempt $i: HTTP $code"
  if [ "$code" = "200" ]; then ok=1; break; fi
done

if [ "$ok" != "1" ]; then
  echo "!! Health check FAILED -- rolling back to dist.bak-${STAMP}"
  ssh_run "set -e; cd $APP_DIR; APP=\$(pwd -P); rm -rf \"\$APP/dist\"; mv \"\$APP/dist.bak-${STAMP}\" \"\$APP/dist\"; touch \"\$APP/tmp/restart.txt\""
  echo "!! Rolled back. Investigate before retrying."
  exit 1
fi

# Refresh the auto-deploy self-audit baseline to the current reflog top, so the
# next run can detect any hPanel re-clone that happens in between. Best-effort.
if [ -n "${reflog_top:-}" ]; then
  ssh_run "set -e; cd $APP_DIR; APP=\$(pwd -P); cat > \"\$APP/.deploy-reflog-baseline\"" <<< "$reflog_top" || echo "   (warn: could not update $BASELINE)"
fi

echo "==> Deploy OK. Rollback snapshot kept at $APP_DIR/dist.bak-${STAMP}"
echo "    (remove old snapshots periodically: ssh ... 'rm -rf $APP_DIR/dist.bak-*')"

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
# PRECONDITION: Hostinger hPanel Git auto-deploy MUST be disconnected first, or it
# will re-clone over this and reintroduce the race (and wipe the gitignored .env).
# See docs runbook. This script NEVER touches the server .env or DB.
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

echo "==> [1/6] Local build (tsc)"
npm run build

echo "==> [2/6] Verify the built entry + preload parse locally (node --check)"
node --check dist/index.js
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
# Resolve the app dir to an ABSOLUTE path on the remote first. APP_DIR may be a
# tilde path (default "~/domains/..."); tilde does NOT expand inside the double
# quotes used for the mv/mkdir targets below, so a literal "~" path would send
# every swapped file into a junk relative dir that rm -rf then deletes — a silent
# no-op deploy. Capturing $ROOT via `cd $APP_DIR; pwd` (unquoted cd does expand ~)
# makes all targets absolute and quote-safe.
ssh_run "set -e; cd $APP_DIR; ROOT=\"\$(pwd)\"; \
  cp -r dist dist.bak-${STAMP}; \
  cd \"\$ROOT/$STAGE/dist\"; \
  find . -type f | while read -r f; do \
    mkdir -p \"\$ROOT/dist/\$(dirname \"\$f\")\"; \
    mv -f \"\$f\" \"\$ROOT/dist/\$f\"; \
  done; \
  cd \"\$ROOT\"; cp -f \"\$ROOT/$STAGE/package.json\" package.json; rm -rf \"\$ROOT/$STAGE\""

echo "==> [5/6] Restart Passenger (touch restart marker)"
ssh_run "touch $APP_DIR/tmp/restart.txt"

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
  ssh_run "set -e; cd $APP_DIR; rm -rf dist; mv dist.bak-${STAMP} dist; touch tmp/restart.txt"
  echo "!! Rolled back. Investigate before retrying."
  exit 1
fi

echo "==> Deploy OK. Rollback snapshot kept at $APP_DIR/dist.bak-${STAMP}"
echo "    (remove old snapshots periodically: ssh ... 'rm -rf $APP_DIR/dist.bak-*')"

# barmatrix-api — how to deploy to production

**One command, no manual hPanel steps, no `.env` dance.** This is the single
authoritative deploy procedure. If anything elsewhere (old memory, handoffs,
runbooks) tells you to "disconnect hPanel before merging" on every push — that is
stale; read this instead.

---

## TL;DR

```bash
cd /c/barmatrix-api        # or the api-repo symlink under BMO
bash scripts/deploy.sh     # build locally, atomic-swap dist on prod, restart, verify
```

- **Pushing to `main` is NOT how you deploy.** Push freely for git provenance.
- **`scripts/deploy.sh` is the deploy.** It is atomic and self-rolling-back.
- Secrets are **not** in the repo and are **never** touched by a deploy.

---

## The architecture (why it's safe now)

Prod is Hostinger Node.js + Passenger at `~/domains/barmatrix.app/nodejs`
(`api.barmatrix.app`, served by `hcdn` — **not** Cloud Run; the Cloud Run service
is dead).

Two historical failure modes caused recurring 503s. Both are addressed:

| Failure mode | Status | Mechanism |
|---|---|---|
| Re-clone wipes the gitignored `.env` → `Missing required env var` → 503 | **RETIRED** | Secrets live in `~/secrets/barmatrix-api.env` (chmod 600, outside the clone dir). `src/config.ts` loads them from there (candidate order: `BARMATRIX_ENV_FILE` → `~/secrets/barmatrix-api.env` → `/home/u211961595/secrets/barmatrix-api.env` → repo `.env`). A re-clone can no longer break boot. There is **no** in-tree `.env`. |
| Re-clone + in-place `tsc` rebuild → Passenger reads a half-written `dist/*.js` → SyntaxError → 503 (self-heals after build) | **AVOIDED by not auto-deploying** | `deploy.sh` builds locally, uploads to a staging dir, and **atomically renames** each file into `dist/`. Passenger only ever sees a complete old or complete new file. The race only exists if hPanel auto-deploy rebuilds in place — so keep auto-deploy OFF. |

### hPanel Git auto-deploy must stay DISCONNECTED

Hostinger's hPanel "Git" integration, when connected with auto-deploy, does a
**fresh `git clone` into the live app dir on every push to `main`**, then
`npm install` + `npm run build`. The clone is authenticated by the read-only
deploy key `hostinger-barmatrix-api-readonly` on the repo. This reintroduces the
build race above. There is **no in-page auto-deploy toggle** — you disconnect the
Git integration itself:

> hPanel → Websites → **barmatrix.app** → **Git** → disconnect / remove the
> deployment for `auronpep/barmatrix-api`.

This is a **one-time** action. Once done, push-to-main has zero prod effect and
`deploy.sh` is the only thing that changes prod.

### Self-audit (so no one has to remember)

`deploy.sh` never writes the server's `.git`. On every successful run it records
the prod `git reflog` top into `~/domains/barmatrix.app/nodejs/.deploy-reflog-baseline`.
On the next run, the **[0/6] preflight** compares the current reflog top to that
baseline:

- **unchanged** → auto-deploy is OFF/idle → proceeds quietly.
- **changed** → something rewrote prod `.git` (= hPanel auto-deploy fired on a
  push) → prints a loud one-time-fix banner. Still safe to continue; the deploy
  is atomic.

Run a standalone check any time:

```bash
ssh -i ~/.ssh/barmatrix_hostinger_20260527_ed25519 -p 65002 u211961595@191.96.56.130 \
  'cd ~/domains/barmatrix.app/nodejs && echo "now : $(git reflog --date=iso | head -1)" && echo "base: $(cat .deploy-reflog-baseline 2>/dev/null)"'
```

If `now` ≠ `base`, auto-deploy got reconnected — disconnect it again.

---

## Deploy procedure (detail)

```bash
cd /c/barmatrix-api
DRY_RUN=1 bash scripts/deploy.sh   # optional preview: preflight + build + node --check, no remote changes
bash scripts/deploy.sh             # real deploy
```

What it does:
1. **[0/6]** Preflight auto-deploy self-audit (read-only).
2. **[1/6]** `npm run build` locally (tsc → `dist/`).
3. **[2/6]** `node --check dist/index.js` + `dist/sentry-init.js` (parse-verify the build).
4. **[3/6]** scp `dist/` + `package.json` to a fresh `deploy-stage-<ts>/` on prod.
5. **[4/6]** Snapshot live `dist/` → `dist.bak-<ts>`, then `mv` (atomic rename) each
   staged file into `dist/`, then swap `package.json`, then remove the stage dir.
6. **[5/6]** `touch tmp/restart.txt` (Passenger restarts on next request).
7. **[6/6]** Health-check `https://api.barmatrix.app/health` (up to 6×5s). On
   failure, **auto-rolls back** to `dist.bak-<ts>` and restarts.

Overridable via env: `SSH_KEY`, `SSH_PORT`, `SSH_HOST`, `APP_DIR`, `HEALTH_URL`,
`DRY_RUN`, `SKIP_AUTODEPLOY_CHECK`.

It **never** touches the server `.env`, `~/secrets/`, or the database.

---

## Editing production secrets / config

Edit the external file, then restart — never the repo `.env`:

```bash
ssh -i ~/.ssh/barmatrix_hostinger_20260527_ed25519 -p 65002 u211961595@191.96.56.130
nano ~/secrets/barmatrix-api.env          # chmod 600; 26 vars incl. DATABASE_HOST=127.0.0.1, sk_live/pk_live
touch ~/domains/barmatrix.app/nodejs/tmp/restart.txt
```

Notes:
- `DATABASE_HOST=127.0.0.1` (IPv4) — `localhost` resolves to `::1` and the MySQL
  grant is IPv4-only.
- Clerk + Stripe must be the **live** keys (`pk_live`/`sk_live`).

---

## Rollback

Each deploy keeps a `dist.bak-<ts>` snapshot. To roll back manually:

```bash
ssh -i ~/.ssh/barmatrix_hostinger_20260527_ed25519 -p 65002 u211961595@191.96.56.130 \
  'cd ~/domains/barmatrix.app/nodejs && rm -rf dist && mv dist.bak-<ts> dist && touch tmp/restart.txt'
```

Prune old snapshots periodically: `rm -rf ~/domains/barmatrix.app/nodejs/dist.bak-*`.

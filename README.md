# barmatrix-api

Backend API for [BarMatrix.app](https://barmatrix.app). Node 24 / TypeScript / Express / `pg` / Stripe / Clerk.

## Production target

**Google Cloud Run** (us-central1) at `api.barmatrix.app`, backed by **Cloud SQL Postgres 16** via Unix socket. See [ADR 0004](https://github.com/auronpep/barmatrix-ops-center/blob/main/docs/decisions/0004-reverse-to-cloud-stack.md) (supersedes ADR 0003).

## Source of truth

| Surface | Where |
|---|---|
| API contracts | `BARMATRIX/engineering/API_CONTRACTS.md` (SRC-0020) |
| Database schema | `BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql` (canonical Postgres) |
| Locked offer + decisions | `BARMATRIX/CLAUDE.md`, `BARMATRIX/RULES.md`, `BARMATRIX/MASTER_CONTEXT.md` |
| Capacity language | `BARMATRIX/DRIFT_CONTROL.md` allowed phrases |

## Local development

```bash
npm install
cp .env.example .env       # fill in real values; never commit
# Option A: start the Cloud SQL Auth Proxy so DATABASE_HOST=127.0.0.1 reaches Cloud SQL
#   cloud-sql-proxy barmatrix-496201:us-central1:barmatrix-db &
# Option B: point DATABASE_HOST at a local Postgres seeded from SCHEMA_ONE_COHORT.sql
npm run dev                # starts on http://localhost:8080 with auto-reload
```

Then in another shell:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/cohort/status
```

## Apply Postgres schema

For local dev (after `.env` is set and a proxy or local Postgres is reachable):

```bash
npm run migrate
```

This reads `../BMO/BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql` and applies it.

For Cloud SQL production: the schema was applied during initial provisioning via direct `psql` over an authorized-network allowlist (see [HANDOFFS/09_GCP_VERCEL_MIGRATION_HANDOFF.md](https://github.com/auronpep/barmatrix-ops-center/blob/main/HANDOFFS/09_GCP_VERCEL_MIGRATION_HANDOFF.md) Phase 1).

## Deploy to Cloud Run

The canonical deploy command lives in [HANDOFFS/09](https://github.com/auronpep/barmatrix-ops-center/blob/main/HANDOFFS/09_GCP_VERCEL_MIGRATION_HANDOFF.md) Phase 3. Summary:

```bash
gcloud run deploy barmatrix-api \
    --source . \
    --region us-central1 \
    --add-cloudsql-instances barmatrix-496201:us-central1:barmatrix-db \
    --set-env-vars=...   # see handoff for the full list
    --set-secrets=DATABASE_PASSWORD=barmatrix-db-password:latest,...
```

Cloud Build packages the source from the Dockerfile in this repo, pushes to Artifact Registry, and rolls out the revision.

## Endpoints

Skeleton implementations of the SRC-0020 contracts. TODO markers in source flag the parts that need real logic before launch.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | DB ping + status |
| GET | `/api/cohort/status` | Public capacity copy from `cohort_public_status` view |
| POST | `/api/diagnostic/start` | Create diagnostic session |
| POST | `/api/attempts` | Record answer attempt |
| GET | `/api/attempts/:id/forensics` | Wrong-answer forensics card |
| POST | `/api/checkout/create-session` | Stripe Checkout Session for $999 or 2-pay |
| POST | `/api/webhooks/stripe` | Stripe webhook receiver (raw body) |
| POST | `/api/referrals/click` | Capture partner attribution |

## Security posture

- All production credentials live in Secret Manager and are injected at deploy time; never in source or local `.env` outside dev
- Stripe webhook signature is verified before any action
- CORS allowlist seeded from `ALLOWED_ORIGINS`
- Helmet adds default secure headers
- Zod validates every request body
- `pg` uses positional placeholders (`$1`) — no string-concatenated SQL
- The internal capacity number (1,000) is NEVER returned in any API response

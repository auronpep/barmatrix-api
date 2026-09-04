# barmatrix-api

Backend API for [BarMatrix.app](https://barmatrix.app). Node 24 / TypeScript / Express / `mysql2` / Stripe / Clerk.

## Production target

**Hostinger Node.js** at `api.barmatrix.app`, backed by Hostinger MariaDB/MySQL. Cloud SQL Postgres is preserved as a target architecture, but it is not the current writable runtime.

## Source of truth

| Surface | Where |
|---|---|
| API contracts | `BARMATRIX/engineering/API_CONTRACTS.md` (SRC-0020) |
| Database schema | `BARMATRIX/engineering/SCHEMA_MYSQL.sql` and `BARMATRIX/engineering/SCHEMA_KNOWLEDGE_CORE_MYSQL.sql` |
| Locked offer + decisions | `BARMATRIX/CLAUDE.md`, `BARMATRIX/RULES.md`, `BARMATRIX/MASTER_CONTEXT.md` |
| Capacity language | `BARMATRIX/DRIFT_CONTROL.md` allowed phrases |

## Local development

```bash
npm install
cp .env.example .env       # fill in real values; never commit
# Option A: start an SSH tunnel so DATABASE_HOST=127.0.0.1 reaches Hostinger MySQL
# Option B: point DATABASE_HOST at a local MySQL/MariaDB seeded from SCHEMA_MYSQL.sql
npm run dev                # starts on http://localhost:8080 with auto-reload
```

Then in another shell:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/cohort/status
```

## Apply schema

For local dev (after `.env` is set and a tunnel or local MariaDB/MySQL is reachable):

```bash
npm run migrate
```

This reads the configured schema path and applies it.

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
| GET | `/api/knowledge/search` | Internal knowledge-core retrieval with provenance and review gates |
| POST | `/api/checkout/create-session` | Stripe Checkout Session for $999 or 2-pay |
| POST | `/api/webhooks/stripe` | Stripe webhook receiver (raw body) |
| POST | `/api/referrals/click` | Capture partner attribution |
| POST | `/api/webinar/leads` | Store next-session webinar interest; no autoresponder/email is sent |

## Security posture

- All production credentials live in Secret Manager and are injected at deploy time; never in source or local `.env` outside dev
- Stripe webhook signature is verified before any action
- CORS allowlist seeded from `ALLOWED_ORIGINS`
- Helmet adds default secure headers
- Zod validates every request body
- SQL uses positional placeholders (`$1`) converted to MySQL placeholders in `src/db.ts` — no string-concatenated values
- The internal capacity number (1,000) is NEVER returned in any API response
- Sentry error capture is enabled only when `BARMATRIX_API_SENTRY_DSN` or `SENTRY_DSN` is configured

## Knowledge retrieval

Run a local/live retrieval check through the API query helper:

```bash
npm run knowledge:search -- --q decoder --component trap-taxonomy --limit 5
```

Every result includes `source` and `review` blocks. Candidate material remains
candidate material; retrieval does not promote anything.

## Maintainers

- auronpep (owner)

# barmatrix-api

Backend API for [BarMatrix.app](https://barmatrix.app). Node 20+ / TypeScript / Express / mysql2 / Stripe / Clerk.

## Production target

**Hostinger Business Web Hosting → Node.js Selector → `api.barmatrix.app` subdomain.**
See [ADR 0003](https://github.com/auronpep/barmatrix-ops-center/blob/main/docs/decisions/0003-host-on-hostinger-business-instead-of-vercel-and-gcp.md) in the BMO ops repo.

## Source of truth

| Surface | Where |
|---|---|
| API contracts | `BARMATRIX/engineering/API_CONTRACTS.md` (SRC-0020) |
| Database schema | `BARMATRIX/engineering/SCHEMA_MYSQL.sql` (MySQL port of SCHEMA_ONE_COHORT.sql) |
| Locked offer + decisions | `BARMATRIX/CLAUDE.md`, `BARMATRIX/RULES.md`, `BARMATRIX/MASTER_CONTEXT.md` |
| Capacity language | `BARMATRIX/DRIFT_CONTROL.md` allowed phrases |

## Local development

```bash
npm install
cp .env.example .env       # fill in real values
npm run dev                # starts on http://localhost:3000 with auto-reload
```

Then in another shell:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/cohort/status
```

## Apply MySQL schema

After `.env` is populated with Hostinger MySQL credentials:

```bash
npm run migrate
```

This reads `../BMO/BARMATRIX/engineering/SCHEMA_MYSQL.sql` and applies it. Tables are created with `IF NOT EXISTS` so the migrate command is safe to re-run.

## Deploy to Hostinger

1. In hPanel: **Domains → Subdomains** → create `api.barmatrix.app` (or your preferred subdomain).
2. **Advanced → Node.js** → select the subdomain, pick Node 20+, application root `/domains/api.barmatrix.app/api`, app URL `/`, app startup file `dist/index.js`.
3. Upload `dist/`, `package.json`, `package-lock.json`, `.env` via FTPS to that folder.
4. SSH in and `cd ~/domains/api.barmatrix.app/api && npm ci --omit=dev` (or use the Node.js Selector UI's npm install button).
5. Click **Restart** in the Node.js Selector. Hostinger runs `node dist/index.js` under Phusion Passenger.
6. Verify: `curl https://api.barmatrix.app/health`

Once the GitHub repo for this lives at `auronpep/barmatrix-api`, the deploy can be automated via a GitHub Action mirroring `barmatrix-app/.github/workflows/deploy-hostinger.yml` (build + FTPS upload of `dist/` + `package.json` + `.env`).

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

- All credentials live in `.env` only; never commit
- Stripe webhook signature is verified before any action
- CORS allowlist seeded from `ALLOWED_ORIGINS`
- Helmet adds default secure headers
- Zod validates every request body
- mysql2 uses named placeholders — no string-concatenated SQL
- The internal capacity number (1,000) is NEVER returned in any API response

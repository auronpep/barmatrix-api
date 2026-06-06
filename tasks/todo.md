# Ambassador Launch Production Checklist

## Plan

- [x] Preserve uncommitted work with `git stash push -u -m sentry-eaddrinuse-wip`.
- [x] Fetch `origin` and verify the single launch branch/base state.
- [x] Guard-check `src/routes/foundations.ts` and `src/lib/diagnostic.ts`.
- [x] Audit existing diagnostic/foundations code, work orders, schema, and deploy docs.
- [x] A1: parse the 20 diagnostic source files into deterministic data and generated MariaDB SQL.
- [x] A1: serve the fixed 20-question diagnostic set in DIAG order.
- [x] A1: add red-zone recommendation output by reusing `levelForScore()`.
- [x] A1: verify `status='diagnostic'` stays isolated from active pools.
- [x] A1: update the app "12 QUESTIONS" stamp to 20 if the change is trivial.
- [x] A2: verify Foundations drill 2.2 is `COUNT_SELECT` and 2.5 is `MULTI_SELECT`.
- [x] A2: verify or prepare `SCHEMA_FOUNDATIONS_MYSQL.sql`.
- [x] Apply additive/idempotent diagnostic and foundations migrations to production DB.
- [x] Run focused tests including `src/lib/diagnostic.test.ts` and `src/lib/foundations-graded.test.ts`.
- [x] Add/run diagnostic E2E: start -> 20 attempts -> results with red-zones + recommendation.
- [ ] Commit only explicitly changed paths.
- [ ] Verify private remote/target, push `feat/ambassador-launch`, merge to `main`, push `main`.
- [ ] Deploy API with `bash scripts/deploy.sh`.
- [ ] Post-deploy verify `/health`, diagnostic start returns 20 ids, and foundations endpoints respond.

## Review

Pre-deploy verification:

- Production DB migrations applied 2026-06-06: 20 diagnostic questions, 80 diagnostic answer choices, 20 credited choices with empty forensic tags, 60 tagged distractors, zero active-status DIAG leaks.
- `foundations_progress` exists in production; current row count after idempotent apply: 14.
- `FOUNDATIONS_INTERNAL` is unset on production.
- Static isolation audit: active practice/drill/trap/tension routes continue to require `status='active'` or production-gated active/hidden; `/api/questions/:id` allows `diagnostic` only so diagnostic-start IDs can render.
- `npx tsx --test src/lib/diagnostic.test.ts src/lib/ambassador-diagnostic.test.ts src/lib/foundations-graded.test.ts src/routes/placement-diagnostic.test.ts src/routes/attempts.test.ts src/lib/checkout-next-step.test.ts src/lib/diagnostic-pool.test.ts`: PASS, 44 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- Extra `npm test` attempt: required launch coverage passed, then the full glob stopped at `src/routes/me-red-zones.integration.test.ts` because that integration harness imports config before a required DB env is available in the test process.

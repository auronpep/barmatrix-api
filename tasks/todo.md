# Ambassador Launch Production Checklist

# Checkout Provisioning Hardening - 2026-06-13

## Plan

- [x] Add a regression for Clerk provisioning failures so paid fulfillment does not send a broken sign-up fallback email.
- [x] Add a regression for coupon/free Stripe checkout sessions where required first/last custom fields exist but `customer_details.name` is blank.
- [x] Require enrollment access email to have a Clerk access URL after checkout fulfillment.
- [x] Store student full name from Stripe Checkout `first_name` and `last_name` custom fields before falling back to `customer_details.name`.
- [x] Verify focused launch-critical API tests and TypeScript build.
- [x] Deploy to Hostinger and verify live API behavior.

## Review

- Root cause hardening: previous auto-account work created/reused Clerk users, but fulfillment email still had a fallback path that could send users to manual sign-up if Clerk access provisioning failed.
- Name capture hardening: Stripe Checkout already requires `first_name` and `last_name`, including coupon/free checkout, but entitlement storage only read `customer_details.name`.
- Focused tests pass: `node --import tsx --test src\email.test.ts src\checkout.test.ts src\clerk-access.test.ts src\stripe-webhook.test.ts src\entitlement.test.ts` (43 tests).
- `npm run build` passes.
- `git diff --check` passes.
- Production deploy completed on 2026-06-13 UTC via manual equivalent of `scripts/deploy.sh`; API health returned HTTP 200 with `{"ok":true,"db":"up"}`.
- Rollback snapshot on Hostinger: `~/domains/barmatrix.app/nodejs/dist.bak-20260612-192229`.
- Live Stripe checkout smoke created a session with `customer_creation: "always"`, `allow_promotion_codes: true`, `/checkout/success` return URL, and required `first_name` / `last_name` custom fields.
- Deployed build markers confirmed: `dist/email.js` returns `clerk_access_unavailable` when Clerk access URL creation fails, and `dist/entitlement.js` stores full name via `checkoutFullName(session)`.
- 2026-06-13 follow-up verification: active API worktree `C:\barmatrix-api\.worktrees\checkout-clerk-access` is clean on `codex/checkout-provisioning-hardening`, live API health returned `{"ok":true,"db":"up"}`, and current source still creates pay-in-full Checkout Sessions with `customer_creation: "always"`, `allow_promotion_codes: true`, and required `first_name` / `last_name` custom fields.
- 2026-06-13 follow-up verification: production API created live Stripe session `cs_live_b1PjhfRPtD3kqnneKYrxrFqat16IOlqiacUzH6R8JoGaseFR0EVCwkaJYq`; the hosted Stripe Checkout page showed required `First name` and `Last name` fields before coupon entry.
- 2026-06-13 follow-up verification: applying ambassador code `JESUSLOVESYOU` changed the live Stripe Checkout total to `$0.00` / `100% off` while keeping `First name` and `Last name` visible with `0/80 characters (at least 1 character required)`. The final order was not submitted.
- 2026-06-13 follow-up verification passed: `npx tsx --test src\checkout.test.ts src\clerk-access.test.ts src\email.test.ts src\entitlement.test.ts src\stripe-webhook.test.ts` (43/43), `npm run build`, and `git diff --check`.
- 2026-06-13 policy hardening: added a regression that two-pay Checkout Sessions must not set `allow_promotion_codes`, then removed promotion-code exposure from the two-pay branch while leaving pay-in-full coupon entry intact.
- 2026-06-13 policy hardening verification passed: `npx tsx --test src\checkout.test.ts`, `npx tsx --test src\checkout.test.ts src\clerk-access.test.ts src\email.test.ts src\entitlement.test.ts src\stripe-webhook.test.ts` (43/43), `npm run build`, and `git diff --check`.
- 2026-06-13 policy hardening deploy passed via Git Bash `scripts/deploy.sh`; API health returned HTTP 200 and rollback snapshot was kept at `~/domains/barmatrix.app/nodejs/dist.bak-20260612-211938`.
- 2026-06-13 live policy verification passed: fresh pay-in-full Checkout session `cs_live_b1Pk8Q84DfOsFbvBFXPlOyDCFW6mHMXV29c3G2aipVyUbPL7bX1H9Lqenf` showed `Add promotion code` plus required first/last name fields; fresh two-pay Checkout session `cs_live_a1ssGNbtaDajZ579W9yfEW199lrlBa2r9Zht3MVK2eSKfEGxNudAPUR3D5` showed required first/last name fields and no promotion-code textbox.

# Checkout Clerk Access Repair - 2026-06-12

## Plan

- [x] Isolate the work from the dirty main checkout in a clean worktree.
- [x] Confirm current checkout fulfillment, enrollment email, and Clerk SDK shapes.
- [x] Add a failing test for creating a Clerk invitation after a fulfilled Stripe checkout.
- [x] Implement best-effort Clerk invitation creation without rolling back paid fulfillment.
- [x] Wire the enrollment email to prefer the Clerk invitation URL when available.
- [x] Run focused tests, typecheck, build, and deploy dry run.
- [x] Deploy only after verifying the target and deployment scope are safe.

## Review

- Root cause: Stripe Checkout with a 100% coupon can complete with only an email address; the webhook fulfilled DB enrollment and sent a Resend email, but no Clerk invitation/account creation happened.
- Added `src/clerk-access.ts` to create a Clerk invitation with `notify: true`, `ignoreExisting: true`, and a `/sign-up?after=dashboard` redirect for newly fulfilled checkout emails.
- Updated enrollment email handling to create the Clerk invitation before sending the access email and to use Clerk's invitation URL when available.
- Focused tests pass: `npx tsx --test src/clerk-access.test.ts src/email.test.ts src/checkout.test.ts`.
- `npm run typecheck`, `npm run build`, and `DRY_RUN=1 scripts/deploy.sh` pass.
- Production deploy via `scripts/deploy.sh` passed on 2026-06-12 with API health HTTP 200 and rollback snapshot `~/domains/barmatrix.app/nodejs/dist.bak-20260612-153550`.
- Sent a one-time Clerk invitation for the already-completed `votewood@icloud.com` checkout from the live Hostinger runtime.

# Checkout Auto Account Provisioning - 2026-06-12

## Plan

- [x] Verify current Clerk user/sign-in-token and Stripe custom-field contracts.
- [x] Add failing tests for required first/last name fields in Stripe Checkout.
- [x] Add failing tests for automatic Clerk user creation/reuse plus sign-in token email link.
- [x] Implement Stripe Checkout first/last name custom fields.
- [x] Implement automatic Clerk user provisioning and sign-in token generation.
- [x] Verify locally and smoke the Clerk SDK methods from Hostinger.
- [x] Deploy API after dry run and health checks.

## Review

- Stripe Checkout now includes required `first_name` and `last_name` custom fields on pay-in-full and two-pay sessions, so 100% coupon checkouts still collect names.
- Checkout fulfillment now creates or reuses a Clerk user by checkout email, updates names when present, creates a 30-day sign-in-token link, and sends that link in the access email.
- Focused tests pass: `npx tsx --test src/checkout.test.ts src/clerk-access.test.ts src/email.test.ts`.
- `npm run typecheck`, `npm run build`, and `DRY_RUN=1 scripts/deploy.sh` pass.
- Production deploy via `scripts/deploy.sh` passed on 2026-06-12 with API health HTTP 200 and rollback snapshot `~/domains/barmatrix.app/nodejs/dist.bak-20260612-155155`.
- Sent a fresh automatic-account access email for `votewood@icloud.com`; live helper returned an access link and Resend returned `sent`.

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

# C3 Coach Starter Fallback - 2026-06-13

## Plan

- [x] Add focused regression coverage for a starter-coach fallback payload/query.
- [x] Make `/api/me/c3/next` serve a live active question when C3-tagged mold candidates are not available.
- [x] Keep the response honest: mark the coaching target as starter/baseline and `measured: false`.
- [x] Run focused C3 coach tests, typecheck, build, and local parse gates.
- [x] Deploy API and live-verify the Coach no longer lands paid users on a dead coverage-pending state.

## Review

- 2026-06-13: Live paid browser check could open `/coach`, but `Start coaching` returned `Coach coverage pending` / `no_tagged_items` instead of a usable question.
- 2026-06-13: Added `starterCoachQuestionQuery()` and `buildStarterCoachPayload()` so the coach can fall back to an unseen active question with `target_mold: "starter_baseline"` and `measured: false`.
- 2026-06-13: Verification passed: `npx tsx --test src\routes\c3-coach.test.ts`, `npm run typecheck`, `npm run build`, `node --check dist\index.js`, and `node --check dist\sentry-init.js`.
- 2026-06-13: `bash` on this Windows PATH resolves to WSL bash and the deploy dry-run wrapper hung before output; local deploy-equivalent build and parse gates were run manually instead.
- 2026-06-13: Git Bash dry run passed with `SKIP_AUTODEPLOY_CHECK=1 DRY_RUN=1 ./scripts/deploy.sh`; production deploy passed via `./scripts/deploy.sh` with API health HTTP 200 and rollback snapshot `~/domains/barmatrix.app/nodejs/dist.bak-20260612-201131`.
- 2026-06-13: Live browser verification on `/coach` confirmed `Start coaching` now returns a question payload with `Starter C3 Baseline` instead of `Coach coverage pending`.

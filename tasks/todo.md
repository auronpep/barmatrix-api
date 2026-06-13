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

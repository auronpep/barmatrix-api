# BarMatrix API — Backend Audit (2026-06-18)

Read-only audit, 6 parallel review agents across non-overlapping domains. All findings verified at file:line in `C:\barmatrix-api`. No code changed. Ranked by severity × blast radius.

> Loop note: this is run #1 of the `/loop 15m` backend audit. Future runs should dedup against this file and surface *new* findings.

| # | Sev | Title | Location |
|---|-----|-------|----------|
| 1 | CRITICAL | Unauthenticated checkout-recovery → free enrollment | `src/routes/me.ts:471` |
| 2 | CRITICAL | `JSON_ARRAY($7)` MariaDB-incompat → 500 on every wrong-answer drill assign | `src/routes/attempts.ts:412` |
| 3 | HIGH | No rate limiting anywhere (lead/checkout/diagnostic open) | `src/index.ts` |
| 4 | HIGH | No SIGTERM handler → pool not drained on Passenger restart → conn leak | `src/index.ts` / `src/db.ts` |
| 5 | HIGH | No `unhandledRejection`/`uncaughtException` → process crash | `src/index.ts:765` |
| 6 | HIGH | DB pool has no `connectTimeout`/`queueLimit` → one hung query hangs whole API | `src/db.ts:66` |
| 7 | HIGH | Billing-portal `return_url` unvalidated → authenticated open redirect/phishing | `src/index.ts:619,664` |
| 8 | HIGH | `claimDiagnosticAttempts` reassigns attempts w/o verifying anon ownership → account-theft chain | `src/lib/claim-diagnostic.ts:51` |
| 9 | HIGH | Admin secret compared with `!==` (not timing-safe) | `src/routes/admin-c3.ts:27` |
| 10 | HIGH | `localhost` hardcoded into prod CORS allowlist (no NODE_ENV guard) | `src/config.ts:37` |
| 11 | HIGH | C3 SRS read-modify-write race, fire-and-forget on pool → lost SM-2 reps | `src/routes/attempts.ts:745` |
| 12 | HIGH | `schemaReady` module flag races + stays stale-true (DDL skipped) | `day-plan-store.ts:63`, `diagnostic-leads.ts:77`, `webinar-leads.ts:79`, `trap-naming-job.ts:104` |
| 13 | HIGH | `recordCatchupStepCompletion` ignores UPDATE rowCount → XP granted on non-pending catchup | `src/lib/day-plan-store.ts:257` |
| 14 | HIGH | Unbounded `user_red_zones` SELECT in dashboard (no LIMIT) | `src/routes/me.ts:304` |
| 15 | HIGH | N+1 query per diagnostic id in checkout-status routing | `src/routes/me.ts:185` |
| 16 | HIGH | Trap-naming job: N+1 + serial Resend, no timeout, partial-failure 500s | `src/routes/trap-naming-job.ts:182` |
| 17 | HIGH | `readOutlineAtlasNode` loads entire atlas (1000 rows) for a point lookup | `src/lib/outline-atlas.ts:220` |
| 18 | HIGH | `ORDER BY RAND()` full sort on bootcamp pool (≤6/start) + by-subject questions | `boot-camps.ts:190`, `questions.ts:133` |
| 19 | HIGH | `parseMetadata` returns `{}` on parse fail → placement scores silently wrong on read; fallback also skips subject-spread | `placement-diagnostic.ts:143,301` |
| 20 | HIGH | `collectClaimableDiagnosticIds` swallows ALL `diagnostic_leads` DB errors (not just missing-table) | `src/lib/claim-diagnostic.ts:104` |

## Detail

### 1. CRITICAL — Unauthenticated checkout-recovery enrolls anyone for free — `src/routes/me.ts:471`
`POST /api/checkout/:sessionId/recover` has zero auth. Stripe `cs_live_` IDs appear in the post-checkout URL (`/account?checkout_session_id=...`), browser history, referrers. A buyer shares the URL → a non-buyer POSTs `/recover` → enrollment granted. No rate limit either. **Fix:** require Clerk session; verify the session's Stripe email matches the caller. Same applies to the sibling `GET .../status` (#21) which leaks `purchase_id` + entitlement state.

### 2. CRITICAL — `JSON_ARRAY($7)` will 500 on MariaDB — `src/routes/attempts.ts:412`
Wrong-answer-forensics drill INSERT uses `VALUES (..., JSON_ARRAY($7), ...)`. The analogous `/api/drills/start` path (`drills.ts:759`) already learned this and uses `JSON.stringify(ids)` with a plain placeholder. Every wrong answer that triggers a drill assignment hits this path → 500. **Fix:** `JSON.stringify([body.question_id])` + plain `$7`.

### 3. HIGH — Zero rate limiting — `src/index.ts`
`grep rateLimit|slowDown` = 0 hits. Lead-capture, `/api/checkout/create-session` (calls Stripe), and `/api/diagnostic/lead` are all open. 1k req/s fills lead tables, saturates the 10-conn pool, and burns Stripe API quota. **Fix:** `express-rate-limit` global baseline + tight per-route limiter on write/lead/checkout endpoints.

### 4. HIGH — No graceful shutdown → connection leak — `src/index.ts` / `src/db.ts`
No `SIGTERM`/`SIGINT` handler. `deploy.sh` touches `tmp/restart.txt` → Passenger SIGTERMs the old worker → up to 10 pooled MariaDB connections orphaned per restart until `wait_timeout` (hours). A few deploys → `ER_CON_COUNT_ERROR` (already caused one documented outage). **Fix:** SIGTERM handler that `server.close()` → `pool.end()` with a 10s force-exit fallback.

### 5. HIGH — No process-level rejection handlers — `src/index.ts:765`
`server.on("error")` only catches bind failures. Any floating promise rejection outside the Express middleware chain (fire-and-forget after response sent, background task) crashes the process (Node ≥15). Sentry's express integration won't catch it. **Fix:** `process.on("unhandledRejection"|"uncaughtException")` → capture to Sentry, exit on uncaught.

### 6. HIGH — Pool has no timeouts — `src/db.ts:66`
`waitForConnections:true` + no `connectTimeout`/`queueLimit`. One hung query (network blip, `FOR UPDATE` lock in `capacity.ts`, leaked conn from #4) holds a slot forever; the other 9 fill; every later DB call queues indefinitely — silent API-wide hang, no 503. **Fix:** `connectTimeout:5000`, `queueLimit:50`.

### 7. HIGH — Billing-portal open redirect — `src/index.ts:619,664`
`return_url: z.string().url()` accepts any URL and is passed straight to `billingPortal.sessions.create`. A logged-in customer can set `return_url=https://evil.com`; the trusted `billing.stripe.com` "Return to site" then redirects to attacker domain. `checkout.ts:144` already has `isAllowedReturnUrl` — the portal path bypasses it. **Fix:** reuse `isAllowedReturnUrl`.

### 8. HIGH — Diagnostic-attempt ownership theft — `src/lib/claim-diagnostic.ts:51`
`UPDATE student_attempts SET student_id=$1 WHERE set_id=$2 AND student_id<>$1` transfers a session's attempts to the enrolling user with no check that the current owner is the anon placeholder. Chained with `collectClaimableDiagnosticIds` pulling diagnostic IDs by email from `diagnostic_leads`, an attacker who seeds a victim's email at diagnostic-start could re-attribute the victim's history. **Fix:** restrict the UPDATE to `student_id` rows whose email `LIKE 'anon-%@barmatrix.local'`.

### 9. HIGH — Admin secret timing oracle — `src/routes/admin-c3.ts:27`
`req.headers["x-admin-secret"] !== secret` short-circuits per char. Admin routes flip question status and recompute psychometrics. **Fix:** `crypto.timingSafeEqual` on length-padded buffers.

### 10. HIGH — Dev origins always in prod CORS — `src/config.ts:37`
`DEFAULT_ALLOWED_ORIGINS` (localhost:3000) is spread unconditionally into the allowlist with `credentials:true`. On shared Hostinger, a co-tenant/SSRF pivot can make credentialed cross-origin calls as `http://localhost:3000`. **Fix:** include dev origins only when `NODE_ENV!=="production"`.

### 11. HIGH — C3 SRS lost-update — `src/routes/attempts.ts:745`
`upsertSrsRow` does SELECT → mutate in JS → INSERT…ON DUP, on the shared pool, fired `void` (not in the attempt txn). Double-tap Submit → both read stale row → both write same successor → one repetition lost; SM-2 intervals drift short. **Fix:** atomic `INSERT … ON DUPLICATE KEY UPDATE reps=reps+1,…` or CAS on `last_reviewed_ms`.

### 12. HIGH — `schemaReady` race / stale-true — 4 files
`if (schemaReady) return; await ddl(); schemaReady=true;` Concurrent first-requests both run the DDL; worse, a request arriving mid-DDL can read `schemaReady===false`… actually sees false and re-runs — but the real hazard is a request that proceeds before tables exist, and a stale `true` surviving a DB recycle. **Fix:** memoize a single in-flight promise: `ready ??= (async()=>{await ddl()})()`. Or run DDL at startup.

### 13. HIGH — Catchup completion ignores rowCount → bogus XP — `src/lib/day-plan-store.ts:257`
The `UPDATE student_catchup_bank … WHERE status='pending'` rowCount is discarded; the boolean comes only from the `INSERT IGNORE` into progress. A non-pending/absent catchup still grants XP (caller `me-day-plan.ts:147` only null-checks). **Fix:** `if ((updated.rowCount??0)===0) return false;` before the progress insert.

### 14. HIGH — Unbounded dashboard red-zones — `src/routes/me.ts:304`
`SELECT … FROM user_red_zones WHERE student_id=$1 ORDER BY …` with no LIMIT; a heavy user has 500+ rows, all serialized, but downstream only uses 5/dimension. `me-command-deck.ts` correctly `LIMIT`s. **Fix:** `LIMIT 15` (3 dims × 5).

### 15. HIGH — N+1 diagnostic counts — `src/routes/me.ts:185`
`for (const id of ids) { SELECT COUNT(*) … WHERE set_id=$1 }` — up to 11 serial round-trips per checkout-status load. **Fix:** single `… WHERE set_id IN (…) GROUP BY set_id`.

### 16. HIGH — Trap-naming job serial fan-out — `src/routes/trap-naming-job.ts:182`
Per-lead: 1 SELECT + 1 Resend + 1 UPDATE, serial, default limit 200, no timeout. A slow Resend holds the HTTP response open minutes; partial success then 500s with no resumable signal. **Fix:** batch `loadTrap` (`IN(...)`), bounded-concurrency send, single `UPDATE … WHERE lead_id IN(...)`.

### 17. HIGH — Atlas point-lookup loads everything — `src/lib/outline-atlas.ts:220`
`readOutlineAtlasNode` calls `readOutlineAtlas({limit:1000})` then `.find()` in JS to pick one node — O(n) read + LEFT JOIN on every `/outline-atlas/:code` hit, uncached. **Fix:** direct `WHERE code=$1`.

### 18. HIGH — `ORDER BY RAND()` full sorts — `boot-camps.ts:190`, `questions.ts:133`
Forces filesort of the full matching set before LIMIT. Bootcamp `/start` triggers up to 6 (day+mastery × 3 layers) in one txn; by-subject questions does it per drill-selection. Scales linearly with the 3,666-question bank. **Fix:** random-offset draw or over-fetch + Fisher-Yates in JS.

### 19. HIGH — Placement scoring silently degrades — `placement-diagnostic.ts:143,301`
`parseMetadata` returns `{}` on bad JSON; on the *results-read* path `numberFromMetadata` then falls back to right/wrong, so a student's persisted calibration/mechanism scores vanish into plausible-but-wrong values, 200 OK, no log. Separately, the weighted-pick fallback (`:301`) skips `selectDiagnosticQuestionIds`, so a fallback can serve all 18 questions from one subject. **Fix:** log on parse failure (read path); route the fallback through `selectDiagnosticQuestionIds`.

### 20. HIGH — Claim swallows all DB errors — `src/lib/claim-diagnostic.ts:104`
`catch {}` (comment "absence is fine") eats connection drops, deadlocks, column-mismatch — not just `ER_NO_SUCH_TABLE`. A transient DB blip during enrollment → student gets an empty Red-Zone Map day one, no ops signal. **Fix:** rethrow/log unless `code==='ER_NO_SUCH_TABLE'`.

## Also verified (MEDIUM / LOW — backlog)
- **MED** `EXPECTED_BUNDLE_COUNT=0` but docstring says 51 → `validateBundles()` always fails — `diag-remediation.ts:128`.
- **MED** `sampleGamma` throws uncaught → crashes C3 coach next-question for a degenerate posterior — `c3-bandit.ts:26`.
- **MED** LeadMe submit "snapshot not found"/"missing hash" throw opaque 500 instead of 404/422 — `leadme-submit-service.ts:117`.
- **MED** `recordInstallmentPayment` idempotency in JSON col, no `SELECT … FOR UPDATE` → concurrent webhook retries can double-credit `net_collected_cents` — `entitlement.ts:259`.
- **MED** `rolloverPriorDailySteps` sequential await loop, run on every GET; multi-day absence = 6+ serial round-trips — `day-plan-store.ts:197` (parallelize).
- **MED** No cache/ETag on `JSON_TABLE` catalog queries (`/api/traps`, `/api/tensions`) — full unnest per public request — `traps.ts:182`, `tensions.ts:205`.
- **MED** `me-confusion` fetches `LIMIT 4000` joined rows into memory per request — `me-confusion.ts:98`.
- **MED** Trap-naming job: no concurrency guard → overlapping cron double-sends emails — `trap-naming-job.ts:145` (claim rows w/ `processing_at` or `FOR UPDATE SKIP LOCKED`).
- **MED** `GET /api/checkout/:sessionId/status` leaks `purchase_id` + `entitlement_status` to unauth callers — `me.ts:423`.
- **LOW** `progress_pct` div-by-zero when manifest has 0 steps → `NaN`→`null` — `day-plan.ts:766`.
- **LOW** NULL `diagnostic_id` bypasses the `(email,diagnostic_id)` UNIQUE key → silent duplicate leads — `diagnostic-leads.ts:68`.
- **LOW** Stripe error-summary redaction `\b\d{4}\b` strips years/codes but misses PAN fragments — `stripe-event-audit.ts:233`.

## Confirmed clean (don't re-flag)
Stripe webhook registers raw-body route *before* `express.json()`. CORS sets `Vary: Origin`, uses explicit allowlist (`callback(null,false)` on miss — no origin reflection). All SQL parameterized via `$N`→`?`. Malformed-JSON handled w/o leaking stack traces. `internalJobSecret=""` correctly disables the job endpoint.

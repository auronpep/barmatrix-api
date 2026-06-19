# Branch Consolidation Review

## Goal

Recover a single active API version by reviewing current Git state, identifying which branches are already represented on `main`, which branches still contain useful work, and which branches/worktrees should be archived or removed only after explicit approval.

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

- [x] Verify current branch, worktree cleanliness, and remote target.
- [x] Inventory local branches, remote-tracking branches, tags, stashes, and linked worktrees.
- [x] Classify every branch as merged, divergent/useful, stale/archive candidate, or unsafe to touch because it is checked out elsewhere.
- [x] Review high-risk diffs against `main`: checkout/Lead Me, C3/J7, email, gamification, diagnostic, telemetry, and Sentry branches.
- [x] Identify the likely active/live version from local `main`, `origin/main`, and live deployment tags.
- [x] Run verification on the two candidate active versions: current `main` and latest live-tag branch.
- [x] Produce a consolidation recommendation: active branch, branches to keep, branches to merge/cherry-pick, branches to archive/delete later, and required approvals.
- [ ] Do not push, delete branches, prune remotes, reset, or merge until the recommendation is reviewed and approved.

## Review

### Current State

- Primary worktree: `main` at `fd98438`, clean before this review and aligned with `origin/main`.
- Remote: `origin` is `https://github.com/auronpep/barmatrix-api.git` for fetch and push. No push should happen without explicit approval and visibility confirmation.
- Current tracked change: this review file only, `tasks/todo.md`.
- Linked worktrees are clean:
  - `C:\barmatrix-api\.worktrees\checkout-clerk-access` is actually `codex/checkout-provisioning-hardening`.
  - Other active worktrees hold C3, J7, email, gamification, telemetry, Sentry, diagnostic, and trap-naming topic branches.
- Stashes exist and must be reviewed before cleanup:
  - `stash@{0}` on `main`: very large CQ/outline/drills/items rebuild-like stash, about 202k insertions across 46 files.
  - `stash@{1}` on `feat/ambassador-launch`: ambassador diagnostic/lead route stash, 12 files.
  - `stash@{2}` on `fix/listen-eaddrinuse-sentry`: Sentry/package instrumentation stash, 6 files.

### Active Version Finding

- `main` / `origin/main` is not the latest live-tag state.
- Latest live tag `live-lead-me-guided-actions-api-2026-06-13-13b87fa` points to `codex/checkout-provisioning-hardening`.
- `codex/checkout-provisioning-hardening` is not merged into `main`; it has 14 commits not in `main`.
- `main` has 4 commits not in that live branch:
  - `072dfc2` CQ batch generator.
  - `b914749` CQ canonical slug/FK-safe batch.
  - `62fc6cf` 180-file drop-folder ingestion.
  - `fd98438` merge commit.
- Risk: deploying `main` as-is can drop live checkout provisioning, Clerk access, coupon policy, C3 fallback, checkout recovery email, and Lead Me link behavior.

### Verification

- `npm run typecheck`: PASS on `main`.
- `npm run typecheck`: PASS on `codex/checkout-provisioning-hardening` worktree.
- `npm run build`: PASS on `main`.
- `npm run build`: PASS on `codex/checkout-provisioning-hardening` worktree.
- `npm test`: both candidates fail only because `src/routes/me-red-zones.integration.test.ts` requires MySQL on `127.0.0.1:3306`, which is not running here.
  - `main`: 444 passing tests, 5 cancelled child tests from the DB setup failure.
  - latest live branch: 459 passing tests, 5 cancelled child tests from the same DB setup failure.

### Branch Classification

Archive candidates already represented on `main`:

- `codex/c3-foundations-strategy-deploy`
- `codex/webinar-lead-capture`
- `feat/ambassador-launch`
- `feat/c3-count-sequence-drills`
- `feat/c3-program`
- `feat/j7-lead-me-path`
- `feat/trap-naming-email`
- `fix/diag-attempt-uniqueness`
- `origin/feat/foundations-method-course`
- `origin/fix/eaddrinuse-clean`
- `test/launch-contract-guard` is patch-equivalent to a main commit, so archive after confirmation.

Keep/review branches with useful work:

- `codex/checkout-provisioning-hardening`: primary consolidation candidate. Merge/review this into `main` first after handling `tasks/todo.md` noise.
- `feat/email-engine-phase1`: useful but old/stale branch; do not merge whole. Review and port selectively.
- `feat/gamification-levels`: useful unique commit `c5b226a`; merge or port selectively.
- `feat/gamification-universal-xp`: useful unique commit `5684097`; merge or port selectively.
- `feat/attempt-telemetry`: useful five-commit telemetry stack; review and port selectively.
- `feat/sentry-tracing-eaddrinuse`: only unique behavior appears to be `4f90882`, suppressing missing checkout-session recovery alerts; review before porting.
- `codex/j7-guided-path`: do not merge whole. It creates a parallel guided-path API/store while main already has richer day-plan/path behavior; extract ideas only if still wanted.
- `feat/c3-reflex-trainer`: do not merge whole. Main already has newer C3/foundations behavior, and merge-tree reports conflicts in C3/foundations files.
- `fix/listen-eaddrinuse-sentry`: do not merge whole. It mixes old diagnostic/C3 launch stack with already-merged EADDRINUSE work.

### Recommended Consolidation Order

1. Treat `codex/checkout-provisioning-hardening` as the live-protection branch and integrate/review it onto current `main` first.
2. Re-run `typecheck`, `build`, and focused checkout/email/entitlement/day-plan/C3 coach tests after that integration.
3. Preserve live tags as deployment markers.
4. Archive/delete only ancestor or patch-equivalent branches after explicit approval, especially because many are checked out in linked worktrees.
5. Review stashes before dropping anything; `stash@{0}` likely contains unfinished rebuild work and should not be applied blindly.
6. After the live-protection merge is stable, selectively port remaining useful work by feature area: gamification, attempt telemetry, email engine, Sentry alert suppression, then any J7/C3 ideas.

## 2026-06-17 GitHub Branch Cleanup

### Plan

- [x] Verify the GitHub remote and repository visibility before any branch mutation.
- [x] Fetch/prune and inventory current local, remote, worktree, and stash state.
- [x] Confirm `origin/main` is the GitHub default branch and identify every remote branch that is not `main`.
- [x] Check whether any non-`main` remote branches have open PRs or branch-protection blockers.
- [x] Delete all non-`main` branches from GitHub, leaving `main` as the only remote branch.
- [x] Fetch/prune after deletion and verify GitHub reports only `main`.
- [x] Record final results and any branches GitHub refused to delete.

### Notes

- Target remote: `origin` -> `https://github.com/auronpep/barmatrix-api.git`.
- GitHub repository visibility confirmed private through `gh repo view`.
- Scope is GitHub remote branch cleanup. Local worktrees and stashes are being inventoried but not removed unless separately needed.

### Review

- Result: GitHub now has only one branch, `main`.
- Default branch: `main`.
- Remaining remote head from `git ls-remote --heads origin`: `f1f869f7daffefb4a195eb579d27ae711aa4de52 refs/heads/main`.
- `gh api repos/auronpep/barmatrix-api/branches --paginate --jq '.[].name'` returned only `main`.
- Open PR check after cleanup returned `[]`.
- No branch deletion failed.
- Local note: this worktree is still on local branch `codex/content-reset-learning`, and its upstream is now gone. Local branches, worktrees, tags, and stashes were not removed.

Deleted GitHub branches:

- `claude/site-audit-izvda2`
- `codex/checkout-clerk-access`
- `codex/checkout-provisioning-hardening`
- `codex/content-reset-learning`
- `codex/j7-guided-path`
- `deploy/command-deck-api-live`
- `feat/ambassador-launch`
- `feat/attempt-telemetry`
- `feat/c3-count-sequence-drills`
- `feat/c3-program`
- `feat/c3-reflex-trainer`
- `feat/command-deck-api`
- `feat/confusion-capture`
- `feat/email-engine-phase1`
- `feat/foundations-method-course`
- `feat/gamification-levels`
- `feat/gamification-universal-xp`
- `feat/sentry-tracing-eaddrinuse`
- `feat/trap-naming-email`
- `fix/diag-attempt-uniqueness`
- `fix/eaddrinuse-clean`
- `fix/listen-eaddrinuse-sentry`
- `fix/post-checkout-flow-2026-06-15`
- `integ/deferred-2026-06-15`
- `test/sb-enrolled-proof`

## 2026-06-19 Claude Backend Audit Repair

### Plan

- [x] Preserve existing uncommitted API work and patch only the Claude audit hot paths.
- [x] Fix critical security/data-integrity issues: checkout recovery auth, answer-key auth, red-zone auth, debrief-event ownership, MariaDB drill assignment JSON.
- [x] Fix cheap high-severity hardening items where the existing code already has the pattern: billing portal return URL validation, DB pool timeout/queue limit, deploy restart path expansion, Docker/Sentry runtime user.
- [x] Add the smallest focused regression tests or assertions for changed behavior.
- [x] Run focused tests, `npm run typecheck`, and `npm run build`; record results here.

### Notes

- Source reports: `docs/BACKEND_AUDIT_2026-06-18.md` and `docs/BACKEND_AUDIT_2026-06-18_run2.md`.
- Current worktree already contains Claude/user changes in LeadMe, answer-key, debrief, outline-atlas, `src/index.ts`, `src/routes/path.ts`, and this file. Do not revert them.

### Review

- 2026-06-19: Verification passed before deploy: focused audit suite `45/45`, full `npm test` `615/615`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- 2026-06-19: Production deploy completed via `scripts/deploy.sh`; build, `node --check`, atomic swap, Passenger restart, and health check passed.
- 2026-06-19: Live smoke passed after deploy: `/health` returned DB up, unauthenticated answer-key/debrief-intel/checkout recovery returned 401, and `/api/red-zones?student_id=...` returned the locked empty state instead of caller-selected student data.
- 2026-06-19: Captured the deployed tree on private branch `codex/api-live-hardening-2026-06-19` at commit `3a56080`; pushed follow-up closeout commits only to private `auronpep/barmatrix-api`. `main` was not moved.

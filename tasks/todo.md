# Branch Consolidation Review

## Goal

Recover a single active API version by reviewing current Git state, identifying which branches are already represented on `main`, which branches still contain useful work, and which branches/worktrees should be archived or removed only after explicit approval.

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

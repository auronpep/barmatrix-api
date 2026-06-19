# BarMatrix API — Backend Audit Run #2 (2026-06-18)

Second `/loop 15m` fire. Targeted the surface run #1 did **not** cover: the Foundations grading engine, the newest Jun-17 routes (answer-key / debriefs / attempt-feedback), the C3-coach service layer, knowledge/flashcards/traps/red-zones query paths, and the infra/migration/CI scripts. All findings verified at file:line, deduped against [run #1](BACKEND_AUDIT_2026-06-18.md). No code changed.

**Theme:** several of the newest routes were registered live without their Clerk + enrollment guard — comments literally say "NOT yet wired" / "until Clerk is wired." Three are unauthenticated data-exposure CRITICALs.

| # | Sev | Title | Location |
|---|-----|-------|----------|
| 1 | CRITICAL | `/api/questions/:id/answer-key` has NO auth — full answer key + C3 metadata public | `routes/answer-key.ts:28` |
| 2 | CRITICAL | `/api/red-zones` has NO auth — client-supplied `student_id` → any student's red-zone data | `routes/red-zones.ts:22` |
| 3 | CRITICAL | Debrief-event write skips ownership check when `attempt_event_id` omitted → cross-student analytics poisoning | `lib/student-debrief.ts:259` |
| 4 | HIGH | Answer key shipped on **every** grade response incl. wrong answers (gating bypass) | `lib/c3-drill.ts:249` + `routes/foundations.ts:216` |
| 5 | HIGH | MULTI_SELECT `part_results` leak per-part keys unconditionally | `lib/c3-drill.ts:244` |
| 6 | HIGH | Foundations lesson marked `completed` from client-asserted status, no attempt check | `routes/foundations.ts:297` + `lib/foundations.ts:356` |
| 7 | HIGH | `/api/debrief-intel/*` public, exposes internal review/editorial metadata | `routes/debrief-intel.ts:22,42` |
| 8 | HIGH | LeadMe debrief-intel query unbounded — deserializes every `yaml_json_text` blob per load | `lib/leadme-debrief-service.ts:222` |
| 9 | HIGH | `forkCandidatesQuery` omits the `ANNOTATED` gate → defect/NEEDS_HUMAN items served as fork practice | `lib/c3-coach-queries.ts:57` |
| 10 | HIGH | Coach candidate pool (25) == seen-window (25), no attempted-dedup in SQL → re-serves just-seen questions | `lib/c3-coach-queries.ts:41` + `routes/c3-coach.ts:180` |
| 11 | HIGH | Coach serial waterfall: N awaited `ORDER BY RAND()` round-trips per request, no preflight | `routes/c3-coach.ts:179` |
| 12 | HIGH | Unguarded `JSON.parse` in `parseSubmitResult` → corrupt payload = uncaught crash on LeadMe replay | `lib/leadme-runtime-store.ts:109` |
| 13 | HIGH | LIKE-metachar injection: unescaped `%`/`_` in knowledge search → full-table-scan DoS | `lib/knowledge.ts:203` |
| 14 | HIGH | Streak read-modify-write race: plain `SELECT` (no `FOR UPDATE`) in tx → lost streak days | `lib/gamification-store.ts:70` |
| 15 | HIGH | N+1: one INSERT per reviewed flashcard, up to 200 pool round-trips/request | `routes/flashcards.ts:93` |
| 16 | HIGH | `/api/me/traps` `JSON_TABLE` unnest of all wrong attempts, no LIMIT/cache | `lib/me-traps.ts:49` |
| 17 | HIGH | Dockerfile `CMD` bypasses Sentry `--import` preload → Cloud Run has zero error reporting | `Dockerfile:20` |
| 18 | HIGH | Migration runner: no transaction, no applied-tracking, `multipleStatements` on env-driven path | `scripts/apply-schema.mjs:43` |
| 19 | HIGH | Container runs as root — no `USER node` in runtime stage | `Dockerfile:12` |
| 20 | HIGH | `deploy.sh` `~` in `APP_DIR` not expanded on remote in restart + baseline steps → silent no-restart | `scripts/deploy.sh:105,126` |

## Detail

### 1. CRITICAL — Public answer-key endpoint — `routes/answer-key.ts:28`
No `clerkMiddleware`, no `resolveClerkStudent`, no enrollment check. Anyone with (or guessing) a question UUID gets `is_correct`, `why_wrong_or_correct`, `why_attractive`, `c3_filter_broken`, `c3_mold_code`, `c3_architecture` for every choice. The file comment ("NOT yet wired into the live runner") shows it was mounted without a gate. **Fix:** add the `resolveClerkStudent`→enrolled guard used in `attempt-feedback.ts:27` / `student-debriefs.ts:38`; until then 503 the route.

### 2. CRITICAL — Public red-zones endpoint w/ client student_id — `routes/red-zones.ts:22`
`GET /api/red-zones?student_id=<uuid>` runs with zero auth and returns that student's full weakness map. Distinct from run #1 #14 (that was an *authenticated* unbounded query; this is *no auth at all*). **Fix:** derive student server-side from the Clerk session; ignore the query param.

### 3. CRITICAL — Debrief-event ownership bypass — `lib/student-debrief.ts:259`
```ts
if (input.attemptEventId && !(await ownsDebriefAttempt(db,{...}))) return null;
// attemptEventId omitted → guard skipped → INSERT proceeds
```
`attempt_event_id` is `nullable().optional()`. Omit it and any enrolled student can POST fabricated `element_viewed`/`detour_completed` events against any `qid`, polluting `debrief_element_stats` (the content-scoring signal). **Fix:** when `attemptEventId` is absent, still require the student to have an attempt on that `qid`.

### 4. HIGH — Answer key on every grade response — `lib/c3-drill.ts:249`
`gradeC3Attempt` always returns `correct_status`, `correct_choice_id`, `choice_statuses` from the server-side key; `routes/foundations.ts:216` forwards the whole result. `toPublicItem` protects the *lesson-load* path but not the *grade* path — submit any (wrong) answer, read the key from the response. **Fix:** include key fields only when `correct === true`, or define a `C3GradeResultPublic`.

### 5. HIGH — MULTI_SELECT per-part key leak — `lib/c3-drill.ts:244`
Each `part_results[i]` emits `correct_choice_id` unconditionally. Submit `selected_parts:{}` → get the full 4-part key (answer/phase/band/mechanism) for drills 2.5/13.5/14.5. Distinct code path from #4. **Fix:** `correct_choice_id: partCorrect ? p.correct_choice_id : undefined`.

### 6. HIGH — Client-asserted lesson completion — `routes/foundations.ts:297` + `lib/foundations.ts:356`
`normalizeProgressUpdate` trusts body `status`; `POST {status:"completed"}` upserts `foundations_progress.status='completed'` with zero drill attempts. Becomes a full course-gating bypass once graded drills are restored. **Fix:** derive completion server-side from `foundations_attempts` counts, or require ≥1 correct attempt per drill.

### 7. HIGH — Public debrief-intel — `routes/debrief-intel.ts:22,42`
Both `/api/debrief-intel/elements[/:id]` are unauthenticated and return `review_status`, `method_class`, `source_count`, `student_signal`, `splitting_fact`, `review_truth`, `student_script` — the editorial content DB, enumerable by competitors. **Fix:** gate behind enrollment or define a narrow public projection stripping internal fields.

### 8. HIGH — Unbounded debrief-intel query — `lib/leadme-debrief-service.ts:222`
Sibling `readDebriefIntelElements` caps at 100; this one (called on every `GET /api/me/debriefs/:qid` with an attempt id) has **no LIMIT** and deserializes every matching `yaml_json_text` blob. **Fix:** `LIMIT 20` (the JS `appliesToSelection` filter discards the rest anyway).

### 9. HIGH — Fork path bypasses the human gate — `lib/c3-coach-queries.ts:57`
Every other coach query joins `AND verdict IN ('PASS','FORK_OR_SPLIT')` (the `ANNOTATED` constant); the fork query's `is_fork=1` arm has no such guard, so a `NEEDS_HUMAN`/`DEFECT`-verdict question can be served as fork practice. **Fix:** add `AND ${ANNOTATED}` to the join.

### 10. HIGH — Coach re-serves seen items — `lib/c3-coach-queries.ts:41` + `routes/c3-coach.ts:180`
`CANDIDATE_POOL=25` and `RECENTLY_SEEN_LIMIT=25`; `ORDER BY RAND()` can return all-seen, exhausting the pool so `?? candidates[0]!` re-serves a just-seen question. **Fix:** raise pool ≫ seen-window, or add `NOT IN (recent attempts)` to SQL; make the fallback return null.

### 11. HIGH — Coach serial waterfall — `routes/c3-coach.ts:179`
`for (cand of ranking) await pool.query(candidatesForMoldQuery…)` — up to N (mold count) sequential `ORDER BY RAND()` round-trips per request, holding a pool slot for seconds, then returns success-shaped `UNAVAILABLE` with no log distinguishing empty-vs-slow. **Fix:** one preflight `DISTINCT c3_mold_code` query to skip empty molds.

### 12. HIGH — Unguarded replay parse — `lib/leadme-runtime-store.ts:109`
`return JSON.parse(payload)` with no try/catch; a truncated `response_payload_json` throws a context-free SyntaxError → 500 with no student/qid/column signal (siblings guard their parses). **Fix:** wrap and rethrow with context.

### 13. HIGH — Knowledge LIKE-metachar injection — `lib/knowledge.ts:203`
User `q` is bound (parameterized — not SQLi) but `%`/`_` are unescaped into `LIKE CONCAT('%',?,'%')`. `q=_____` or `q=%` matches everything → full `body` table scan, defeating FULLTEXT. **Fix:** escape `[\\%_]` and add `ESCAPE '\\'`, or drop the LIKE fallback.

### 14. HIGH — Streak race — `lib/gamification-store.ts:70`
Plain `SELECT … FROM student_gamification` inside `START TRANSACTION` takes no row lock under REPEATABLE READ; two concurrent activity grants read the same `last_active_date` and one day's advance is lost. Distinct from run #1 #11 (that was fire-and-forget on the pool; this is within a dedicated-connection tx). **Fix:** `SELECT … FOR UPDATE`.

### 15. HIGH — Flashcards N+1 — `routes/flashcards.ts:93`
`for (cardId of reviewed) await getPool().query(INSERT…)` — up to 200 separate pool round-trips per complete. **Fix:** single multi-row `INSERT IGNORE`.

### 16. HIGH — me-traps unbounded JSON_TABLE — `lib/me-traps.ts:49`
`UNION ALL` of two `JSON_TABLE` unnests over *all* of a student's wrong attempts, no LIMIT, no cache, recomputed per `GET /api/me/traps`. **Fix:** `LIMIT` recent attempts per branch + index `student_attempts(student_id,correct,attempted_at)`; long-term materialize counts.

### 17. HIGH — Sentry off on Cloud Run — `Dockerfile:20`
`CMD ["node","dist/index.js"]` skips the `--import ./dist/sentry-init.js` preload that `npm start` uses, so `initSentry()` never runs before Express is imported → no tracing/error capture on the Cloud Run path. **Fix:** `CMD ["node","--import","./dist/sentry-init.js","dist/index.js"]`.

### 18. HIGH — Unsafe migration runner — `scripts/apply-schema.mjs:43`
`multipleStatements:true` + `connection.query(sql)` with no transaction, no `schema_migrations` tracking → mid-file failure leaves a half-applied schema; every `npm run migrate` re-executes all statements (dangerous if any ALTER/INSERT/DROP); `SCHEMA_PATH` is env-driven. **Fix:** version table + applied-hash skip; validate `SCHEMA_PATH`; wrap logical blocks.

### 19. HIGH — Container runs as root — `Dockerfile:12`
No `USER` instruction; runtime stage runs as uid 0, maximizing RCE blast radius. **Fix:** `USER node` (+ `--chown=node:node` on COPY).

### 20. HIGH — deploy.sh silent no-restart — `scripts/deploy.sh:105,126`
The exact documented `~`-in-double-quotes class: step-4 swap was fixed with `pwd -P`, but `touch $APP_DIR/tmp/restart.txt` (restart) and the reflog-baseline `cat >` still pass literal `~/domains/…` to a non-login remote shell that won't expand it → Passenger never restarts, health check hits the *old* worker, deploy reports OK while new code is never live. **Fix:** resolve via `$HOME`/`pwd -P` like step 4.

## Also verified (MEDIUM / LOW — backlog)
- **MED** `attempt-feedback` accepts any ≤128-char `attemptEventId` (no UUID check) → 3-table timing-enumeration oracle for enrolled callers — `routes/attempt-feedback.ts:15`.
- **MED** `readDebriefSections` unbounded (`compiled_json_text` blobs, no LIMIT) — `lib/student-debrief.ts:148`.
- **MED** `c3-solver-service` serial per-row choices + enqueueReview → up to ~1,500 round-trips/run, partial-fail silent — `lib/c3-solver-service.ts:54`.
- **MED** Criminal `isContentReset` silent-passes validation when files are empty, no version marker (RP validator has the marker; criminal doesn't) — `lib/c3-subjects-validate.ts:53`.
- **MED** `CHOICE_CLASSIFICATION` silently unpassable when authored `choice_statuses` is undefined (always graded wrong, no log) — `lib/c3-drill.ts:298`.
- **MED** `DATABASE_PASSWORD ?? BARMATRIX_DB_KEY` split-brain in migration runner; empty-string `DATABASE_PASSWORD` bypasses the fallback; not in `.env.example` — `scripts/apply-schema.mjs:41`.
- **LOW** `isCorrect` has no `default`/explicit return type → a future task type silently grades all-wrong — `lib/c3-drill.ts:261`.

## Notes
No real secrets in committed files (`.env` gitignored; `.env.example` placeholders blank). Stripe raw-body ordering, CORS allowlist, and `$N`→`?` parameterization remain clean (per run #1). The `foundations.data.ts` module loads once at import (not per request).

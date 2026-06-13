// SQL builders for the C3 Coach. All take student_id as $1. Only annotated,
// servable questions (PASS/FORK_OR_SPLIT) participate. db.ts rewrites $n -> ?.
import { ANNOTATED } from "./c3-queries.js";

export function attemptStreamQuery(): string {
  return `
    SELECT a.question_id AS question_id, a.correct AS correct,
           sel.c3_mold_code AS bitten_mold, a.attempted_at AS attempted_at
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
      LEFT JOIN answer_choices sel
        ON sel.question_id = a.question_id AND sel.letter = a.selected_letter
     WHERE a.student_id = $1
     ORDER BY a.attempted_at ASC`;
}

export function questionMoldsQuery(): string {
  return `
    SELECT DISTINCT a.question_id AS question_id, ac.c3_mold_code AS mold_code
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
      JOIN answer_choices ac ON ac.question_id = a.question_id AND ac.c3_mold_code IS NOT NULL
     WHERE a.student_id = $1`;
}

export function srsStateQuery(): string {
  return `
    SELECT mold_code, reps, lapses, ease, interval_days, last_reviewed_ms, due_at_ms
      FROM student_c3_srs WHERE student_id = $1`;
}

export function recentlySeenQuery(): string {
  return `
    SELECT a.question_id AS question_id
      FROM student_attempts a
     WHERE a.student_id = $1
     ORDER BY a.attempted_at DESC
     LIMIT $2`;
}

export function candidatesForMoldQuery(): string {
  return `
    SELECT q.question_id AS question_id
      FROM questions q
      JOIN c3_annotations an ON an.question_id = q.question_id AND ${ANNOTATED}
      JOIN ( SELECT DISTINCT question_id FROM answer_choices WHERE c3_mold_code = $2 ) qm
        ON qm.question_id = q.question_id
     WHERE q.status = 'active'
     ORDER BY RAND()
     LIMIT $3`;
}

// Fork-injection candidates: active questions whose annotation is a kept hard
// item (FORK_OR_SPLIT verdict or is_fork). $1 = pool size. Student-level
// "recently seen" filtering happens in code against the seen Set, mirroring
// candidatesForMoldQuery.
export function forkCandidatesQuery(): string {
  return `
    SELECT q.question_id AS question_id
      FROM questions q
      JOIN c3_annotations an ON an.question_id = q.question_id
     WHERE q.status = 'active'
       AND (an.verdict = 'FORK_OR_SPLIT' OR an.is_fork = 1)
     ORDER BY RAND()
     LIMIT $1`;
}

// Representative mold meta for a fork question, so the coach payload can still
// route remediation. $1 = question_id. May return zero rows (untagged fork);
// the route falls back to a synthetic fork mold.
export function forkMoldForQuestionQuery(): string {
  return `
    SELECT m.code AS mold_code, m.family AS family, m.name AS name,
           m.lesson_slug AS lesson_slug, m.deck_ref AS deck_ref
      FROM answer_choices ac
      JOIN c3_molds m ON m.code = ac.c3_mold_code
     WHERE ac.question_id = $1 AND ac.c3_mold_code IS NOT NULL
     LIMIT 1`;
}

// Starter coach fallback: if the C3 mold layer has no servable candidate yet,
// keep the paid Coach usable by serving an ordinary active question the student
// has not already attempted. It deliberately does not join c3_annotations.
export function starterCoachQuestionQuery(): string {
  return `
    SELECT q.question_id AS question_id
      FROM questions q
     WHERE q.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM student_attempts a
          WHERE a.student_id = $1 AND a.question_id = q.question_id
       )
     ORDER BY RAND()
     LIMIT $2`;
}

export function servableQuestionQuery(): string {
  return `
    SELECT question_id, external_id, subject, topic, subtopic, tension_point,
           fact_pattern, question_stem, call_of_question
      FROM questions WHERE question_id = $1 AND status = 'active' LIMIT 1`;
}

export function servableChoicesQuery(): string {
  return `
    SELECT choice_id, letter, choice_text
      FROM answer_choices WHERE question_id = $1 ORDER BY letter ASC`;
}

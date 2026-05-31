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

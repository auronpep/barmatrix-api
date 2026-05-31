// barmatrix-api/src/lib/c3-queries.ts
// SQL builders for Stream A. All take student_id as $1. Only annotated, servable
// questions (PASS/FORK_OR_SPLIT) count. db.ts rewrites $n -> positional ?.

export const ANNOTATED = "an.verdict IN ('PASS','FORK_OR_SPLIT')";

// Per-mold: exposures = distinct attempts on questions where the mold is on ANY choice;
// bites = those where the student's selected choice carries the mold; difficulty-weighted too.
export function moldStatsQuery(): string {
  return `
    SELECT m.code AS mold_code, m.family AS family, m.default_exam_weight AS weight,
           m.name AS name, m.lesson_slug AS lesson_slug, m.deck_ref AS deck_ref,
           COUNT(DISTINCT a.attempt_id) AS exposures,
           COUNT(DISTINCT CASE WHEN sel.c3_mold_code = m.code THEN a.attempt_id END) AS bites,
           SUM(an.difficulty) AS w_exposure,
           SUM(CASE WHEN sel.c3_mold_code = m.code THEN an.difficulty ELSE 0 END) AS w_bite
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
      JOIN ( SELECT DISTINCT question_id, c3_mold_code
               FROM answer_choices WHERE c3_mold_code IS NOT NULL ) qm
        ON qm.question_id = a.question_id
      JOIN c3_molds m ON m.code = qm.c3_mold_code
      LEFT JOIN answer_choices sel
        ON sel.question_id = a.question_id AND sel.letter = a.selected_letter
     WHERE a.student_id = $1
     GROUP BY m.code, m.family, m.default_exam_weight, m.name, m.lesson_slug, m.deck_ref`;
}

export function phaseAccuracyQuery(): string {
  return `
    SELECT an.deciding_phase AS phase,
           AVG(a.correct) AS accuracy, COUNT(*) AS n
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
     WHERE a.student_id = $1 AND an.deciding_phase IS NOT NULL
     GROUP BY an.deciding_phase`;
}

// Ear vs Issue-Sense accuracy: a question is an "exposure" of a family if any of its
// distractors carries a mold in that family.
export function familyAccuracyQuery(): string {
  return `
    SELECT m.family AS family, AVG(a.correct) AS accuracy, COUNT(DISTINCT a.attempt_id) AS n
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
      JOIN ( SELECT DISTINCT question_id, c3_mold_code FROM answer_choices
              WHERE c3_mold_code IS NOT NULL ) qm ON qm.question_id = a.question_id
      JOIN c3_molds m ON m.code = qm.c3_mold_code
     WHERE a.student_id = $1
     GROUP BY m.family`;
}

export function cleanCutQuery(): string {
  return `
    SELECT AVG(a.correct) AS hit_rate, COUNT(*) AS n
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
     WHERE a.student_id = $1 AND an.difficulty = 1`;
}

export function calibrationQuery(): string {
  return `
    SELECT a.confidence AS confidence, AVG(a.correct) AS actual, COUNT(*) AS n
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
     WHERE a.student_id = $1 AND a.confidence IS NOT NULL
     GROUP BY a.confidence`;
}

export function coverageQuery(): string {
  return `
    SELECT
      COUNT(*) AS total_attempts,
      COUNT(CASE WHEN an.question_id IS NOT NULL THEN 1 END) AS measured_attempts
      FROM student_attempts a
      LEFT JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
     WHERE a.student_id = $1`;
}

// Facet: C3 family accuracy sliced by subject.
export function subjectFacetQuery(): string {
  return `
    SELECT q.subject AS subject, AVG(a.correct) AS accuracy, COUNT(*) AS n
      FROM student_attempts a
      JOIN c3_annotations an ON an.question_id = a.question_id AND ${ANNOTATED}
      JOIN questions q ON q.question_id = a.question_id
     WHERE a.student_id = $1
     GROUP BY q.subject ORDER BY accuracy ASC`;
}

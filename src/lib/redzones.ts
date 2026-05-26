// Red-zone bookkeeping helpers.
//
// proficiency_score formula:
//   correct_count / (attempts_count + high_confidence_wrong_count)
// A high-confidence wrong (confidence >= 4) doubles its own weight by adding 1
// to the denominator on top of the +1 it already contributes via attempts_count
// — i.e., confident wrongs are penalized twice as hard as low-confidence wrongs.
//
// We recompute proficiency from student_attempts on every update rather than
// store correct_count separately, because user_red_zones doesn't carry a
// correct_count column (changing the schema is out of scope per the handoff).

import type { PoolClient } from "pg";

export interface RedZoneUpdate {
  dimension: string;
  tag: string;
}

// Question columns whose values double as red-zone tags. These are the
// dimensions GET /api/red-zones surfaces by default for Phase 1.
export const QUESTION_DIMENSION_COLUMNS: ReadonlyArray<{
  dimension: string;
  column: "subject" | "subtopic" | "tension_point";
}> = [
  { dimension: "subject", column: "subject" },
  { dimension: "subtopic", column: "subtopic" },
  { dimension: "tension_point", column: "tension_point" },
];

/**
 * Upsert a single (student_id, dimension, tag_value) row in user_red_zones,
 * recomputing proficiency_score from the full student_attempts history for
 * that tag. Returns the (dimension, tag) tuple for inclusion in the API
 * response's `red_zone_updates[]` array.
 *
 * Caller must already be inside a transaction so that the historical count
 * the recompute sees includes the just-inserted attempt.
 */
export async function upsertColumnDerivedRedZone(
  client: PoolClient,
  studentId: string,
  dimension: string,
  column: "subject" | "subtopic" | "tension_point",
  value: string,
): Promise<RedZoneUpdate | null> {
  if (!value) return null;
  // Identifier (column name) is from a constant array, never user input — safe
  // to interpolate. Values are all parameterized.
  const sql = `
    WITH stats AS (
      SELECT
        COUNT(*)::int AS attempts_count,
        SUM(CASE WHEN a.correct THEN 1 ELSE 0 END)::int AS correct_count,
        SUM(CASE WHEN NOT a.correct AND a.confidence >= 4 THEN 1 ELSE 0 END)::int AS hc_wrong
      FROM student_attempts a
      JOIN questions q ON q.question_id = a.question_id
      WHERE a.student_id = $1 AND q.${column} = $2
    )
    INSERT INTO user_red_zones
      (student_id, dimension, tag_value, proficiency_score, attempts_count, high_confidence_wrong_count, last_updated)
    SELECT
      $1,
      $3,
      $2,
      CASE WHEN (s.attempts_count + s.hc_wrong) > 0
           THEN s.correct_count::numeric / (s.attempts_count + s.hc_wrong)
           ELSE 0
      END,
      s.attempts_count,
      s.hc_wrong,
      NOW()
    FROM stats s
    ON CONFLICT (student_id, dimension, tag_value) DO UPDATE
    SET proficiency_score = EXCLUDED.proficiency_score,
        attempts_count = EXCLUDED.attempts_count,
        high_confidence_wrong_count = EXCLUDED.high_confidence_wrong_count,
        last_updated = NOW();
  `;
  await client.query(sql, [studentId, value, dimension]);
  return { dimension, tag: value };
}

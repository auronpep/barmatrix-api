import type { JsonValue, LeadMeSubmitResult } from "./leadme-submit.js";
import type { DbPool } from "../db.js";

type Queryable = Pick<DbPool, "query">;

export interface LeadMeScoringInput {
  result: LeadMeSubmitResult;
  studentId: string;
  attemptEventId: string;
  subject: string;
  primaryOutlineCode: string;
  confidence?: number | null;
}

export interface ScoringSignal {
  type: string;
  value: string;
  strength?: string;
}

export interface LeadMeScoringProjection {
  outline_event: {
    event_id: string;
    student_id: string;
    outline_code: string;
    source: "leadme";
    source_id: string;
    event_type: "leadme_submit";
    correctness: LeadMeSubmitResult["correctness"];
    scoring_signal_json: JsonValue | null;
  };
  outline_perf_delta: {
    mastery_delta: number;
    attempts_delta: 1;
    correct_delta: 0 | 1;
  };
  red_zone_updates: Array<{
    red_zone_id: string;
    tag_type: string;
    tag_value: string;
    severity: "low" | "medium" | "high";
    score_delta: number;
  }>;
  tag_mastery_updates: Array<{
    tag_type: string;
    tag_value: string;
    attempts_delta: 1;
    correct_delta: 0 | 1;
  }>;
  confidence_update: {
    calibration_key: string;
    confidence_bucket: "low" | "medium" | "high";
    attempts_delta: 1;
    correct_delta: 0 | 1;
    overconfidence_delta: number;
    underconfidence_delta: number;
  } | null;
}

const MAX_MASTERY_DELTA = 0.08;
const MAX_RED_ZONE_DELTA = 0.25;

function asRecord(value: JsonValue | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function signalArray(value: unknown): ScoringSignal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.type !== "string" || typeof record.value !== "string") return [];
    return [{
      type: record.type,
      value: record.value,
      strength: typeof record.strength === "string" ? record.strength : undefined,
    }];
  });
}

function strengthWeight(strength: string | undefined): number {
  if (strength === "strong" || strength === "high") return 1;
  if (strength === "medium") return 0.5;
  if (strength === "light" || strength === "low") return 0.25;
  return 0.5;
}

function modifierMultiplier(modifiers: ScoringSignal[]): number {
  return modifiers.reduce((current, signal) => {
    if (signal.value === "wrong_high_confidence") return current * 1.25;
    if (signal.value === "selected_dominant_trap") return current * 1.35;
    if (signal.value === "correct_low_confidence") return current * 0.65;
    return current;
  }, 1);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function confidenceBucket(value: number | null | undefined): "low" | "medium" | "high" | null {
  if (value === null || value === undefined) return null;
  if (value >= 70) return "high";
  if (value <= 40) return "low";
  return "medium";
}

function severity(scoreDelta: number): "low" | "medium" | "high" {
  if (scoreDelta >= 0.1) return "high";
  if (scoreDelta >= 0.05) return "medium";
  return "low";
}

export function projectLeadMeScoring(input: LeadMeScoringInput): LeadMeScoringProjection {
  const signals = asRecord(input.result.scoring_signals);
  const correctSignals = signalArray(signals.correct_demonstrates);
  const incorrectSignals = signalArray(signals.incorrect_indicates);
  const modifiers = signalArray(signals.observed_modifiers);
  const isCorrect = input.result.correctness === "correct";
  const relevantSignals = isCorrect ? correctSignals : incorrectSignals;
  const maxWeight = Math.max(0.5, ...relevantSignals.map((signal) => strengthWeight(signal.strength)));
  const multiplier = modifierMultiplier(modifiers);
  const signedMastery = (isCorrect ? 1 : -1) * MAX_MASTERY_DELTA * maxWeight * multiplier;
  const masteryDelta = round(
    Math.max(-MAX_MASTERY_DELTA, Math.min(MAX_MASTERY_DELTA, signedMastery)),
  );
  const correctDelta: 0 | 1 = isCorrect ? 1 : 0;

  const redZoneUpdates = incorrectSignals
    .filter((signal) => signal.type === "red_zone")
    .map((signal) => {
      const scoreDelta = round(
        Math.min(MAX_RED_ZONE_DELTA, 0.1 * strengthWeight(signal.strength) * multiplier),
      );
      return {
        red_zone_id: `${input.subject}:${input.primaryOutlineCode}:${signal.type}:${signal.value}`,
        tag_type: signal.type,
        tag_value: signal.value,
        severity: severity(scoreDelta),
        score_delta: scoreDelta,
      };
    });

  const tagMasterySignals = [...correctSignals, ...incorrectSignals].filter((signal) =>
    ["red_zone", "trap", "tension", "c3_phase", "gold_key", "silver_key"].includes(signal.type),
  );

  const bucket = confidenceBucket(input.confidence);
  const confidenceUpdate = bucket
    ? {
        calibration_key: `${input.subject}:${input.primaryOutlineCode}:${bucket}`,
        confidence_bucket: bucket,
        attempts_delta: 1 as const,
        correct_delta: correctDelta,
        overconfidence_delta: !isCorrect && bucket === "high" ? MAX_MASTERY_DELTA : 0,
        underconfidence_delta: isCorrect && bucket === "low" ? MAX_MASTERY_DELTA : 0,
      }
    : null;

  return {
    outline_event: {
      event_id: input.attemptEventId,
      student_id: input.studentId,
      outline_code: input.primaryOutlineCode,
      source: "leadme",
      source_id: input.result.item_id,
      event_type: "leadme_submit",
      correctness: input.result.correctness,
      scoring_signal_json: input.result.scoring_signals,
    },
    outline_perf_delta: {
      mastery_delta: masteryDelta,
      attempts_delta: 1,
      correct_delta: correctDelta,
    },
    red_zone_updates: redZoneUpdates,
    tag_mastery_updates: tagMasterySignals.map((signal) => ({
      tag_type: signal.type,
      tag_value: signal.value,
      attempts_delta: 1,
      correct_delta: correctDelta,
    })),
    confidence_update: confidenceUpdate,
  };
}

export async function applyLeadMeScoringProjection(
  db: Queryable,
  projection: LeadMeScoringProjection,
): Promise<void> {
  await db.query(
    `INSERT INTO student_outline_events
       (event_id, student_id, outline_code, source, source_id, event_type,
        correctness, scoring_signal_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      projection.outline_event.event_id,
      projection.outline_event.student_id,
      projection.outline_event.outline_code,
      projection.outline_event.source,
      projection.outline_event.source_id,
      projection.outline_event.event_type,
      projection.outline_event.correctness,
      JSON.stringify(projection.outline_event.scoring_signal_json ?? {}),
    ],
  );

  const status = projection.outline_perf_delta.mastery_delta < 0 ? "repair" : "building";
  await db.query(
    `INSERT INTO student_outline_perf
       (student_id, outline_code, status, mastery_score, attempts, correct,
        accuracy, last_attempt_at, last_seen_at)
     VALUES ($1, $2, $3, LEAST(1, GREATEST(0, 0.5 + $4)), $5, $6, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       mastery_score = LEAST(1, GREATEST(0, COALESCE(mastery_score, 0.5) + $4)),
       attempts = attempts + VALUES(attempts),
       correct = correct + VALUES(correct),
       accuracy = (correct + VALUES(correct)) / NULLIF(attempts + VALUES(attempts), 0),
       last_attempt_at = CURRENT_TIMESTAMP,
       last_seen_at = CURRENT_TIMESTAMP`,
    [
      projection.outline_event.student_id,
      projection.outline_event.outline_code,
      status,
      projection.outline_perf_delta.mastery_delta,
      projection.outline_perf_delta.attempts_delta,
      projection.outline_perf_delta.correct_delta,
    ],
  );

  for (const update of projection.red_zone_updates) {
    const subject = update.red_zone_id.split(":")[0] ?? null;
    await db.query(
      `INSERT INTO student_red_zones
         (student_id, red_zone_id, subject, primary_outline_code, tag_type,
          tag_value, severity, score, evidence_count, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         severity = VALUES(severity),
         score = LEAST(1, COALESCE(score, 0) + VALUES(score)),
         evidence_count = evidence_count + 1,
         last_seen_at = CURRENT_TIMESTAMP`,
      [
        projection.outline_event.student_id,
        update.red_zone_id,
        subject,
        projection.outline_event.outline_code,
        update.tag_type,
        update.tag_value,
        update.severity,
        update.score_delta,
      ],
    );
  }

  for (const update of projection.tag_mastery_updates) {
    const delta = update.correct_delta === 1 ? MAX_MASTERY_DELTA : -MAX_MASTERY_DELTA;
    await db.query(
      `INSERT INTO student_tag_mastery
         (student_id, tag_type, tag_value, mastery_score, attempts, correct, last_attempt_at)
       VALUES ($1, $2, $3, LEAST(1, GREATEST(0, 0.5 + $4)), $5, $6, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         mastery_score = LEAST(1, GREATEST(0, COALESCE(mastery_score, 0.5) + $4)),
         attempts = attempts + VALUES(attempts),
         correct = correct + VALUES(correct),
         last_attempt_at = CURRENT_TIMESTAMP`,
      [
        projection.outline_event.student_id,
        update.tag_type,
        update.tag_value,
        delta,
        update.attempts_delta,
        update.correct_delta,
      ],
    );
  }

  if (projection.confidence_update) {
    const subject = projection.confidence_update.calibration_key.split(":")[0] ?? null;
    await db.query(
      `INSERT INTO student_confidence_calibration
         (student_id, calibration_key, subject, primary_outline_code, confidence_bucket,
          attempts, correct, accuracy, overconfidence_score, underconfidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)
       ON DUPLICATE KEY UPDATE
         attempts = attempts + VALUES(attempts),
         correct = correct + VALUES(correct),
         accuracy = (correct + VALUES(correct)) / NULLIF(attempts + VALUES(attempts), 0),
         overconfidence_score = LEAST(1, COALESCE(overconfidence_score, 0) + VALUES(overconfidence_score)),
         underconfidence_score = LEAST(1, COALESCE(underconfidence_score, 0) + VALUES(underconfidence_score))`,
      [
        projection.outline_event.student_id,
        projection.confidence_update.calibration_key,
        subject,
        projection.outline_event.outline_code,
        projection.confidence_update.confidence_bucket,
        projection.confidence_update.attempts_delta,
        projection.confidence_update.correct_delta,
        projection.confidence_update.overconfidence_delta,
        projection.confidence_update.underconfidence_delta,
      ],
    );
  }
}

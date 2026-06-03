// DIAG v1 student report assembly.
//
// Pure functions that turn a graded diagnostic result (the normalized attempt
// rows the live computeDiagnosticResults produces) plus a matched remediation
// bundle into the student_report_payload shape defined in
// DIAGNOSTIC_RESULT_SCHEMA.yaml.
//
// CONFIDENCE SCALE: the live system stores student confidence as an integer
// 1-5 (NOT 0-100). All thresholds here operate on the 1-5 scale:
//   - overconfident-wrong   = confidence >= 4 && !correct
//   - underconfident-correct = confidence <= 2 && correct

import type { C3Phase, RemediationBundle } from "./diag-remediation.js";

const OVERCONFIDENT_THRESHOLD = 4; // confidence >= 4 is "high" on the 1-5 scale
const UNDERCONFIDENT_THRESHOLD = 2; // confidence <= 2 is "low" on the 1-5 scale

/**
 * A single normalized, graded response row. Shaped to match the live
 * computeDiagnosticResults attempt rows: correct + 1-5 confidence + subject.
 */
export interface GradedResponse {
  question_id: string;
  subject: string | null;
  correct: boolean;
  /** Student confidence on the 1-5 scale (null if not captured). */
  confidence: number | null;
  time_seconds?: number | null;
  selected_display_letter?: string | null;
  /** Per-question forensic diagnosis text, if available. */
  diagnosis?: string | null;
  c3_phase?: C3Phase | null;
}

export interface AssembleReportInput {
  student_id: string;
  responses: GradedResponse[];
  /** The bundle matched to this student's primary failure pattern. */
  bundle: RemediationBundle;
}

export interface ScoreSummary {
  raw_score: number;
  accuracy_pct: number;
  confidence_note: string;
}

export interface PrimaryFailurePattern {
  label: string;
  evidence: string[];
  route_family: string;
}

export interface C3PhaseMapEntry {
  phase: C3Phase;
  miss_count: number;
  instructional_meaning: string;
}

export interface SubjectRedZone {
  subject: string;
  misses: number;
  assigned_overlay: string;
}

export interface AssignedRoute {
  remediation_id: string;
  bundle_id: string;
  lesson_route: string[];
  subject_overlay: string;
  tiny_anchor: string;
}

export interface FirstAssignmentStep {
  minute_range: string;
  task: string;
  success_check: string;
}

export interface QuestionAppendixEntry {
  question_id: string;
  student_pick: string;
  result: "correct" | "wrong";
  diagnosis: string;
}

export interface StudentReportPayload {
  student_id: string;
  diagnostic_version: "DIAG_v1";
  headline_profile: string;
  score_summary: ScoreSummary;
  primary_failure_pattern: PrimaryFailurePattern;
  c3_phase_map: C3PhaseMapEntry[];
  subject_red_zones: SubjectRedZone[];
  assigned_route: AssignedRoute;
  first_30_minute_assignment: FirstAssignmentStep[];
  question_by_question_appendix: QuestionAppendixEntry[];
}

const PHASE_MEANINGS: Record<C3Phase, string> = {
  CUT: "Not hearing overclaims, false rules, wrong actors, or structural contradictions.",
  CLASH:
    "Reached the finalists but did not identify the axis or the dispositive fact.",
  CALL: "Stopped at the wrong layer or lacked the tiny anchor that breaks a bright-line tie.",
};

const PHASE_ORDER: readonly C3Phase[] = ["CUT", "CLASH", "CALL"];

function isOverconfidentWrong(r: GradedResponse): boolean {
  return (
    !r.correct &&
    typeof r.confidence === "number" &&
    r.confidence >= OVERCONFIDENT_THRESHOLD
  );
}

function isUnderconfidentCorrect(r: GradedResponse): boolean {
  return (
    r.correct &&
    typeof r.confidence === "number" &&
    r.confidence <= UNDERCONFIDENT_THRESHOLD
  );
}

function buildConfidenceNote(responses: GradedResponse[]): string {
  const overconfidentWrong = responses.filter(isOverconfidentWrong).length;
  const underconfidentCorrect = responses.filter(isUnderconfidentCorrect).length;
  const parts: string[] = [];
  if (overconfidentWrong > 0) {
    parts.push(
      `${overconfidentWrong} overconfident wrong (confidence >= ${OVERCONFIDENT_THRESHOLD})`,
    );
  }
  if (underconfidentCorrect > 0) {
    parts.push(
      `${underconfidentCorrect} underconfident correct (confidence <= ${UNDERCONFIDENT_THRESHOLD})`,
    );
  }
  if (parts.length === 0) {
    return "Confidence well calibrated to outcomes.";
  }
  return parts.join("; ");
}

function buildScoreSummary(responses: GradedResponse[]): ScoreSummary {
  const total = responses.length;
  const rawScore = responses.filter((r) => r.correct).length;
  const accuracyPct = total > 0 ? rawScore / total : 0;
  return {
    raw_score: rawScore,
    accuracy_pct: accuracyPct,
    confidence_note: buildConfidenceNote(responses),
  };
}

function buildC3PhaseMap(responses: GradedResponse[]): C3PhaseMapEntry[] {
  const missCounts: Record<C3Phase, number> = { CUT: 0, CLASH: 0, CALL: 0 };
  for (const r of responses) {
    if (!r.correct && r.c3_phase && r.c3_phase in missCounts) {
      missCounts[r.c3_phase] += 1;
    }
  }
  return PHASE_ORDER.map((phase) => ({
    phase,
    miss_count: missCounts[phase],
    instructional_meaning: PHASE_MEANINGS[phase],
  }));
}

function buildSubjectRedZones(
  responses: GradedResponse[],
  overlay: string,
): SubjectRedZone[] {
  const missesBySubject = new Map<string, number>();
  for (const r of responses) {
    if (!r.correct && r.subject) {
      missesBySubject.set(r.subject, (missesBySubject.get(r.subject) ?? 0) + 1);
    }
  }
  return [...missesBySubject.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([subject, misses]) => ({
      subject,
      misses,
      assigned_overlay: overlay,
    }));
}

/**
 * Map the bundle's micro_sequence steps to consecutive minute ranges. Each
 * step's duration_minutes determines the width of its block; ranges run from
 * minute 0 onward (e.g. "0-4 min", "4-10 min").
 */
function buildFirstAssignment(bundle: RemediationBundle): FirstAssignmentStep[] {
  const steps: FirstAssignmentStep[] = [];
  let cursor = 0;
  for (const step of bundle.micro_sequence) {
    const start = cursor;
    const end = cursor + step.duration_minutes;
    steps.push({
      minute_range: `${start}-${end} min`,
      task: step.student_task,
      success_check: step.success_check,
    });
    cursor = end;
  }
  return steps;
}

function buildAppendix(responses: GradedResponse[]): QuestionAppendixEntry[] {
  return responses.map((r) => ({
    question_id: r.question_id,
    student_pick: r.selected_display_letter ?? "",
    result: r.correct ? "correct" : "wrong",
    diagnosis: r.diagnosis ?? (r.correct ? "Correct." : "Review remediation route."),
  }));
}

/**
 * Assemble the full student_report_payload from a graded diagnostic result and
 * the matched remediation bundle.
 */
export function assembleStudentReportPayload(
  input: AssembleReportInput,
): StudentReportPayload {
  const { student_id, responses, bundle } = input;
  const profile = bundle.c3_profile;

  return {
    student_id,
    diagnostic_version: "DIAG_v1",
    headline_profile: bundle.title,
    score_summary: buildScoreSummary(responses),
    primary_failure_pattern: {
      label: bundle.student_facing_diagnosis,
      evidence: bundle.source_instances.map((s) => s.question_id),
      route_family: profile.route_family,
    },
    c3_phase_map: buildC3PhaseMap(responses),
    subject_red_zones: buildSubjectRedZones(
      responses,
      bundle.assigned_path.subject_overlay,
    ),
    assigned_route: {
      remediation_id: bundle.remediation_id,
      bundle_id: bundle.bundle_id,
      lesson_route: [...bundle.assigned_path.lesson_route],
      subject_overlay: bundle.assigned_path.subject_overlay,
      tiny_anchor: bundle.assigned_path.tiny_anchor,
    },
    first_30_minute_assignment: buildFirstAssignment(bundle),
    question_by_question_appendix: buildAppendix(responses),
  };
}

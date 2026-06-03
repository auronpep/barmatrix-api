// C3 interactive drill engine — types + pure grader for the Foundations
// ("The Method") reflex trainer. This replaces the lesson's self-checked,
// reveal-key drills with input-gated classification: the student must name the
// break, the server grades, and the verdict/explanation is only ever returned
// AFTER a submission (the public lesson endpoint ships items with answers
// stripped — see lib/foundations.ts).
//
// The vocabulary builds on the existing C3 domain model (docs/c3-enhancements):
// a wrong MBE choice breaks one of two filters — NOT_TRUE or NOT_RESPONSIVE —
// and the credited choice SURVIVES both. C3Status is the student-facing surface
// of that model (TRUE_BUT_NOT_RESPONSIVE is the spoken form of NOT_RESPONSIVE).
//
// Pure (no Express, no pool) so it unit-tests without a DB, matching
// lib/c3-scoring.ts / lib/c3-srs.ts. Fields are snake_case to match the
// generated foundations content module.

// ---- vocabulary ----

/** What a single proposition / answer choice is, in the trainer's terms. */
export type C3Status =
  | "TRUE"
  | "NOT_TRUE"
  | "TRUE_BUT_NOT_RESPONSIVE"
  | "SURVIVES";

/** The interaction shape of a drill item — drives which controls render. */
export type C3TaskType =
  | "TRUTH_CHECK" // pure-law T/F (Drill 1.1) — internally TRUE | NOT_TRUE
  | "FILTER_BREAK" // classify one wrong choice (Drill 1.2)
  | "SURVIVOR_PICK" // pick the survivor from a full MCQ (Drill 1.3)
  | "TRUE_VS_TRUE" // pick the responsive choice of two true ones (Drill 1.4)
  | "MIXED_CLASSIFICATION" // classify a choice incl. credited (Drill 1.5)
  | "CALL_CHECK" // pick the precise question being asked (guided demo)
  | "CHOICE_CLASSIFICATION" // classify every choice in a set
  | "LABEL_SELECT"; // pick the correct label from a fixed set (e.g. Rule/Standard,
  // Ear/Issue-Sense, name-the-mold). choices[] = the labels; correct_choice_id = the label.

/** The skill a miss implicates, for the review summary + future adaptive feed. */
export type C3Skill = "EAR" | "ISSUE_SENSE" | "CUT" | "CLASH" | "CALL";

export type LegalReviewStatus = "pending" | "approved" | "needs_revision";

export type C3SourceStatus =
  | "authored"
  | "legacy_candidate"
  | "licensed"
  | "unknown";

/** The filter the student FAILED to catch on a miss (review grouping key). */
export type C3MissedFilter = "NOT_TRUE" | "NOT_RESPONSIVE" | "SURVIVES";

export interface C3Choice {
  id: string;
  text: string;
}

// ---- the gradeable item (server-side: carries the answer key) ----

export interface C3DrillItem {
  id: string;
  drill_id: string;
  sequence: number;
  task_type: C3TaskType;

  stem?: string;
  prompt: string;
  /** Single choice to classify (FILTER_BREAK / MIXED_CLASSIFICATION). */
  choice_text?: string;
  /** Choice set (SURVIVOR_PICK / TRUE_VS_TRUE / CALL_CHECK / CHOICE_CLASSIFICATION). */
  choices?: C3Choice[];

  correct_status?: C3Status;
  correct_choice_id?: string;
  choice_statuses?: Record<string, C3Status>;

  skill: C3Skill;
  short_explanation: string;
  why_tempting?: string;
  say_the_break: string;

  legal_review_status: LegalReviewStatus;
  source_status: C3SourceStatus;
  enabled: boolean;
}

/**
 * The item as shipped to the browser BEFORE a submission: every answer-bearing
 * field is dropped so the page source cannot leak the key. The grade endpoint
 * is the only place the answer + explanation come from.
 */
export type C3DrillItemPublic = Omit<
  C3DrillItem,
  | "correct_status"
  | "correct_choice_id"
  | "choice_statuses"
  | "short_explanation"
  | "why_tempting"
  | "say_the_break"
>;

export function toPublicItem(item: C3DrillItem): C3DrillItemPublic {
  const {
    correct_status: _cs,
    correct_choice_id: _cc,
    choice_statuses: _csm,
    short_explanation: _se,
    why_tempting: _wt,
    say_the_break: _sb,
    ...pub
  } = item;
  return pub;
}

// ---- grading ----

export interface C3StudentResponse {
  selected_status?: C3Status;
  selected_choice_id?: string;
  selected_choice_statuses?: Record<string, C3Status>;
}

export interface C3Explanation {
  verdict: string;
  why: string;
  trap?: string;
  say_the_break: string;
}

export interface C3GradeResult {
  correct: boolean;
  correct_status?: C3Status;
  correct_choice_id?: string;
  choice_statuses?: Record<string, C3Status>;
  missed_filter: C3MissedFilter | null;
  missed_skill: C3Skill | null;
  explanation: C3Explanation;
}

const STATUS_LABEL: Record<C3Status, string> = {
  TRUE: "TRUE",
  NOT_TRUE: "NOT TRUE",
  TRUE_BUT_NOT_RESPONSIVE: "TRUE BUT NOT RESPONSIVE",
  SURVIVES: "SURVIVES",
};

/** The filter a given status implicates (TRUE clears both → no broken filter). */
function statusToMissedFilter(status: C3Status): C3MissedFilter | null {
  switch (status) {
    case "NOT_TRUE":
      return "NOT_TRUE";
    case "TRUE_BUT_NOT_RESPONSIVE":
      return "NOT_RESPONSIVE";
    case "SURVIVES":
      return "SURVIVES";
    case "TRUE":
      return null;
  }
}

function statusEqual(a: C3Status | undefined, b: C3Status | undefined): boolean {
  return a !== undefined && a === b;
}

/** Deep-equal for the choice→status map (CHOICE_CLASSIFICATION). */
function choiceStatusesEqual(
  expected: Record<string, C3Status> | undefined,
  got: Record<string, C3Status> | undefined,
): boolean {
  if (!expected) return false;
  const g = got ?? {};
  const keys = Object.keys(expected);
  if (keys.length !== Object.keys(g).length) return false;
  return keys.every((k) => g[k] === expected[k]);
}

/**
 * Grade one drill attempt. Pure + total: every task type returns a verdict,
 * and the explanation is uniform (Verdict / Why / Trap / Say the break) so the
 * UI renders one shape regardless of task type.
 *
 * @param item Full item including the answer key (server-side only).
 * @param response What the student submitted.
 */
export function gradeC3Attempt(
  item: C3DrillItem,
  response: C3StudentResponse,
): C3GradeResult {
  const correct = isCorrect(item, response);

  const explanation: C3Explanation = {
    verdict: verdictLine(item),
    why: item.short_explanation,
    trap: item.why_tempting,
    say_the_break: item.say_the_break,
  };

  return {
    correct,
    correct_status: item.correct_status,
    correct_choice_id: item.correct_choice_id,
    choice_statuses: item.choice_statuses,
    missed_filter: correct ? null : missedFilterFor(item, response),
    missed_skill: correct ? null : item.skill,
    explanation,
  };
}

function isCorrect(item: C3DrillItem, response: C3StudentResponse): boolean {
  switch (item.task_type) {
    case "TRUTH_CHECK":
    case "FILTER_BREAK":
    case "MIXED_CLASSIFICATION":
      return statusEqual(response.selected_status, item.correct_status);

    case "CALL_CHECK":
    case "TRUE_VS_TRUE":
    case "LABEL_SELECT":
      return (
        response.selected_choice_id !== undefined &&
        response.selected_choice_id === item.correct_choice_id
      );

    case "SURVIVOR_PICK": {
      const pickedSurvivor =
        response.selected_choice_id !== undefined &&
        response.selected_choice_id === item.correct_choice_id;
      // If the item demands the rejected choices be classified too, the survivor
      // pick alone is not enough — every classification must match.
      if (item.choice_statuses) {
        return (
          pickedSurvivor &&
          choiceStatusesEqual(
            item.choice_statuses,
            response.selected_choice_statuses,
          )
        );
      }
      return pickedSurvivor;
    }

    case "CHOICE_CLASSIFICATION":
      return choiceStatusesEqual(
        item.choice_statuses,
        response.selected_choice_statuses,
      );
  }
}

/** What filter the student missed, for review grouping. */
function missedFilterFor(
  item: C3DrillItem,
  response: C3StudentResponse,
): C3MissedFilter | null {
  // LABEL_SELECT is a labeling skill, not a filter break — the review signal is
  // item.skill, not a missed filter.
  if (item.task_type === "LABEL_SELECT") return null;

  // Single-status tasks: the break is whatever the correct status implicates.
  if (item.correct_status) return statusToMissedFilter(item.correct_status);

  // Pick tasks: the break is whatever the wrongly-picked choice was.
  if (item.choice_statuses && response.selected_choice_id) {
    const picked = item.choice_statuses[response.selected_choice_id];
    if (picked) return statusToMissedFilter(picked);
  }

  // Pick tasks without per-choice statuses: failing to find the survivor.
  if (item.correct_choice_id) return "SURVIVES";

  return null;
}

function verdictLine(item: C3DrillItem): string {
  if (item.task_type === "LABEL_SELECT" && item.correct_choice_id) {
    return `Correct label: ${item.correct_choice_id}.`;
  }
  if (item.correct_status) return STATUS_LABEL[item.correct_status];
  if (item.correct_choice_id) {
    return `The responsive answer is ${item.correct_choice_id}.`;
  }
  return "Classify every choice.";
}

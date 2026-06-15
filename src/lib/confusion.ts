// Confusion-Capture — pure domain helpers for the "instrument the elimination
// process" feature. No DB, no HTTP here (exported for unit tests); the routes in
// routes/attempts.ts (POST + PATCH) and routes/me-confusion.ts wire these to the
// attempt_choice_tags table (SCHEMA_CONFUSION_CAPTURE_MYSQL.sql).
//
// Two buckets per choice:
//   'eliminated'       — the student knew this choice was wrong (ruled it out).
//   'deciding_between' — the student was torn over it (the confusion set).
//
// Choices are keyed by the STABLE answer_choices.choice_id, never the letter:
// answer order can be shuffled per session, so a letter does not durably identify
// a choice. The client sends choice_ids (it already has them on each rendered
// choice); we validate they belong to the question before storing.

import { z } from "zod";
import { snakeToTitle } from "./format.js";

export const CONFUSION_BUCKETS = ["eliminated", "deciding_between"] as const;
export type ConfusionBucket = (typeof CONFUSION_BUCKETS)[number];

export const CONFUSION_SOURCES = [
  "pre_submit",
  "retrospective",
  "revised",
] as const;
export type ConfusionSource = (typeof CONFUSION_SOURCES)[number];

const choiceIdSchema = z.string().uuid();

// Shape validation only. Disjointness (a choice cannot be in both buckets) is a
// cheap structural client error and is enforced here so it fails fast at the
// request boundary, before any DB work. Membership (choice_id belongs to the
// question) needs the question's choices and is checked in buildConfusionTagRows.
export const confusionInputSchema = z
  .object({
    eliminated: z.array(choiceIdSchema).max(4).default([]),
    deciding_between: z.array(choiceIdSchema).max(4).default([]),
    source: z.enum(CONFUSION_SOURCES),
  })
  .refine(
    (v) => {
      const elim = new Set(v.eliminated);
      return v.deciding_between.every((id) => !elim.has(id));
    },
    { message: "a choice cannot be both eliminated and deciding_between" },
  );

export type ConfusionInput = z.infer<typeof confusionInputSchema>;

// PATCH body: the retrospective edit re-asserts the whole set, so it reuses the
// same shape but only allows the two retrospective sources.
export const confusionPatchSchema = z
  .object({
    eliminated: z.array(choiceIdSchema).max(4).default([]),
    deciding_between: z.array(choiceIdSchema).max(4).default([]),
    source: z.enum(["retrospective", "revised"]).default("retrospective"),
  })
  .refine(
    (v) => {
      const elim = new Set(v.eliminated);
      return v.deciding_between.every((id) => !elim.has(id));
    },
    { message: "a choice cannot be both eliminated and deciding_between" },
  );

export type ConfusionPatch = z.infer<typeof confusionPatchSchema>;

export type Letter = "A" | "B" | "C" | "D";

export interface QuestionChoiceRef {
  choice_id: string;
  letter: Letter;
  is_correct: boolean | 0 | 1;
}

export interface ConfusionTagRow {
  choice_id: string;
  letter: Letter;
  bucket: ConfusionBucket;
  is_selected: boolean;
}

export interface BuildConfusionResult {
  rows: ConfusionTagRow[];
  /** choice_ids in the payload that do NOT belong to this question. */
  dropped: string[];
  /** choice_ids that appeared in both buckets (defensive; zod normally rejects first). */
  overlap: string[];
}

/**
 * Resolve a confusion payload (choice_ids) against the question's actual choices
 * into the rows to store. Unknown choice_ids are reported in `dropped` (never
 * thrown) so the caller can decide: the POST path drops-and-records (an attempt
 * is never lost to a confusion glitch); the PATCH path treats any drop/overlap
 * as a 400 (there, confusion IS the payload). Duplicates within a bucket and the
 * already-rejected overlap are de-duped here defensively.
 */
export function buildConfusionTagRows(
  choices: ReadonlyArray<QuestionChoiceRef>,
  input: { eliminated: string[]; deciding_between: string[] },
  selectedChoiceId: string | null,
): BuildConfusionResult {
  const byId = new Map(choices.map((c) => [c.choice_id, c]));
  const elim = new Set(input.eliminated);
  const overlap = [...new Set(input.deciding_between.filter((id) => elim.has(id)))];

  const rows: ConfusionTagRow[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  const add = (id: string, bucket: ConfusionBucket): void => {
    if (seen.has(id)) return;
    const c = byId.get(id);
    if (!c) {
      dropped.push(id);
      return;
    }
    seen.add(id);
    rows.push({
      choice_id: id,
      letter: c.letter,
      bucket,
      is_selected: id === selectedChoiceId,
    });
  };

  for (const id of input.eliminated) add(id, "eliminated");
  // deciding_between yields to eliminated on overlap (disjointness already
  // required by zod; this keeps the helper correct if called directly).
  for (const id of input.deciding_between) {
    if (!elim.has(id)) add(id, "deciding_between");
  }

  return { rows, dropped, overlap };
}

// ---------------------------------------------------------------------------
// Analytics — derive the three high-value signals from stored tags.
// ---------------------------------------------------------------------------

/** One joined tag row: a tagged choice + its attempt + question context. */
export interface ConfusionTagJoinRow {
  attempt_id: string;
  choice_id: string;
  bucket: string; // 'eliminated' | 'deciding_between'
  is_correct: boolean | 0 | 1; // of the TAGGED choice
  letter: string;
  attempt_correct: boolean | 0 | 1;
  external_id: string | null;
  subject: string | null;
  subtopic: string | null;
  forensic_tags: unknown;
}

export interface EliminatedKeyItem {
  attempt_id: string;
  external_id: string | null;
  subject: string | null;
  subtopic: string | null;
  letter: string;
  trap_name: string;
}

export interface ConfusionPair {
  /** stable key: question external_id (or subtopic) + distractor choice_id. */
  key: string;
  external_id: string | null;
  subject: string | null;
  subtopic: string | null;
  correct_letter: string | null;
  distractor_letter: string;
  trap_name: string;
  count: number;
}

export interface ConfusionSignals {
  captured_attempts: number;
  lucky_guess_count: number;
  lucky_guess_rate: number; // 0..1, over captured_attempts
  eliminated_key_count: number;
  coin_flip_wrong_count: number;
  eliminated_key: EliminatedKeyItem[];
  top_confusion_pairs: ConfusionPair[];
}

function truthy(v: boolean | 0 | 1): boolean {
  return v === true || v === 1;
}

/** Wrong-answer trap label from forensic tags / subtopic. Mirrors
 *  routes/me-red-zones.ts trapNameFrom (kept local to avoid a lib->route import). */
function trapName(forensicTags: unknown, subtopic: string | null): string {
  let parsed: unknown = forensicTags;
  if (typeof forensicTags === "string") {
    try {
      parsed = JSON.parse(forensicTags);
    } catch {
      parsed = [];
    }
  }
  const tags = Array.isArray(parsed)
    ? parsed.filter(
        (t): t is string => typeof t === "string" && t !== "correct_answer",
      )
    : [];
  if (tags[0]) return `${snakeToTitle(tags[0])} trap`;
  if (subtopic) return `${subtopic} trap`;
  return "Wrong-answer trap";
}

/**
 * Fold joined tag rows into the three derived signals (see plan):
 *   - eliminated the key:  an 'eliminated' tag on the CORRECT choice (CUT failure).
 *   - coin-flip wrong:     wrong attempt where the key was in 'deciding_between'.
 *   - lucky guess:         correct attempt with >=2 'deciding_between' choices.
 * Plus the top confusion pairs (key vs the distractor it lost to), enriched with
 * the trap label. Pure: groups by attempt, then aggregates.
 */
export function computeConfusionSignals(
  rows: ReadonlyArray<ConfusionTagJoinRow>,
  topN = 10,
): ConfusionSignals {
  const byAttempt = new Map<string, ConfusionTagJoinRow[]>();
  for (const r of rows) {
    const list = byAttempt.get(r.attempt_id) ?? [];
    list.push(r);
    byAttempt.set(r.attempt_id, list);
  }

  let luckyGuess = 0;
  let eliminatedKeyCount = 0;
  let coinFlipWrong = 0;
  const eliminatedKey: EliminatedKeyItem[] = [];
  const pairCounts = new Map<string, ConfusionPair>();

  for (const [, tags] of byAttempt) {
    const deciding = tags.filter((t) => t.bucket === "deciding_between");
    const eliminated = tags.filter((t) => t.bucket === "eliminated");
    const attemptCorrect = tags.length > 0 && truthy(tags[0]!.attempt_correct);

    // Eliminated the key: the student ruled out the correct choice.
    const ruledOutKey = eliminated.find((t) => truthy(t.is_correct));
    if (ruledOutKey) {
      eliminatedKeyCount += 1;
      eliminatedKey.push({
        attempt_id: ruledOutKey.attempt_id,
        external_id: ruledOutKey.external_id,
        subject: ruledOutKey.subject,
        subtopic: ruledOutKey.subtopic,
        letter: ruledOutKey.letter,
        // The key was eliminated, so the "trap" worth naming is whatever they
        // were torn toward instead; fall back to the subtopic.
        trap_name: trapName(
          deciding.find((d) => !truthy(d.is_correct))?.forensic_tags ?? null,
          ruledOutKey.subtopic,
        ),
      });
    }

    // Lucky guess: correct, but the final set held 2+ live options.
    if (attemptCorrect && deciding.length >= 2) luckyGuess += 1;

    // Coin-flip wrong: missed, with the key sitting in the deciding set.
    const keyInDeciding = deciding.find((t) => truthy(t.is_correct));
    if (!attemptCorrect && keyInDeciding) coinFlipWrong += 1;

    // Confusion pairs: the key vs each distractor it could not be separated from.
    if (keyInDeciding) {
      for (const d of deciding) {
        if (truthy(d.is_correct)) continue;
        const key = `${d.external_id ?? d.subtopic ?? "?"}|${d.choice_id}`;
        const existing = pairCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          pairCounts.set(key, {
            key,
            external_id: d.external_id,
            subject: d.subject,
            subtopic: d.subtopic,
            correct_letter: keyInDeciding.letter,
            distractor_letter: d.letter,
            trap_name: trapName(d.forensic_tags, d.subtopic),
            count: 1,
          });
        }
      }
    }
  }

  const captured = byAttempt.size;
  const topPairs = [...pairCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return {
    captured_attempts: captured,
    lucky_guess_count: luckyGuess,
    lucky_guess_rate: captured > 0 ? luckyGuess / captured : 0,
    eliminated_key_count: eliminatedKeyCount,
    coin_flip_wrong_count: coinFlipWrong,
    eliminated_key: eliminatedKey,
    top_confusion_pairs: topPairs,
  };
}

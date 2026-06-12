// Interaction-log validation + summary derivation for student attempts.
// Spec: ABM docs/superpowers/specs/2026-06-12-attempt-telemetry-design.md §4, §6.
// The log is a closed vocabulary; unknown events are rejected so the column
// stays queryable. Telemetry must never block an attempt — callers safeParse
// and drop on failure, they do not 4xx.

import { z } from "zod";

export const MAX_EVENTS = 200;
export const MAX_LOG_BYTES = 16 * 1024;

const LETTERS = ["A", "B", "C", "D"] as const;

const letterEvent = z.object({
  t: z.number().int().min(0),
  ev: z.union([z.literal("select"), z.literal("submit")]),
  letter: z.enum(LETTERS),
});

const plainEvent = z.object({
  t: z.number().int().min(0),
  ev: z.union([z.literal("shown"), z.literal("scroll_stem")]),
});

export const interactionLogSchema = z
  .array(z.union([letterEvent, plainEvent]))
  .max(MAX_EVENTS)
  .superRefine((events, ctx) => {
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];
      if (prev !== undefined && curr !== undefined && curr.t < prev.t) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `non-monotonic t at index ${i}`,
        });
        return;
      }
    }
  });

export type InteractionEvent = z.infer<typeof interactionLogSchema>[number];

export interface TelemetrySummary {
  time_to_first_selection_ms: number | null;
  deliberation_ms: number | null;
  answer_changes: number;
  switched_off_correct: boolean | null;
  stem_rereads: number;
}

export function summarizeInteractionLog(
  events: readonly InteractionEvent[],
  correctLetter: "A" | "B" | "C" | "D" | null,
): TelemetrySummary {
  const letterEvents = events.filter(
    (e): e is Extract<InteractionEvent, { letter: string }> =>
      e.ev === "select" || e.ev === "submit",
  );
  const firstSelect = letterEvents[0] ?? null;
  const submit = letterEvents.find((e) => e.ev === "submit") ?? null;
  const selectOnly = letterEvents.filter((e) => e.ev === "select");
  const firstTrueSelect = selectOnly[0] ?? null;

  let switchedOffCorrect: boolean | null = null;
  if (correctLetter !== null && submit) {
    const touchedCorrect = letterEvents.some((e) => e.letter === correctLetter);
    switchedOffCorrect = touchedCorrect && submit.letter !== correctLetter;
  }

  return {
    time_to_first_selection_ms: firstSelect ? firstSelect.t : null,
    deliberation_ms:
      firstTrueSelect && submit ? submit.t - firstTrueSelect.t : null,
    answer_changes: Math.max(0, selectOnly.length - 1),
    switched_off_correct: switchedOffCorrect,
    stem_rereads: events.filter((e) => e.ev === "scroll_stem").length,
  };
}

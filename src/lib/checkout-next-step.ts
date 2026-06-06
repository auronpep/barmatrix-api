// Pure routing decision for the post-checkout return.
//
// "Completed the diagnostic" means a SINGLE diagnostic session recorded at least
// DIAGNOSTIC_LENGTH attempts. Evaluated per-session (not summed) so two abandoned
// half-sessions never masquerade as a finished placement. Completed -> The Method;
// otherwise -> place first.
import { DIAGNOSTIC_LENGTH } from "./diagnostic.js";

export type NextStep = "foundations" | "diagnostic";

export interface DiagnosticRouting {
  diagnostic_completed: boolean;
  next_step: NextStep;
}

export function routeFromSessionAttemptCounts(
  attemptCountsBySession: readonly number[],
): DiagnosticRouting {
  const completed = attemptCountsBySession.some((n) => n >= DIAGNOSTIC_LENGTH);
  return {
    diagnostic_completed: completed,
    next_step: completed ? "foundations" : "diagnostic",
  };
}

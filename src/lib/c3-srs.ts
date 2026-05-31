// Pure SM-2 spacing at the C3-mold level, recomputed on the fly from the
// student's ordered attempts. No persistence — deterministic per history.
// Bite (selected choice carries the mold) = lapse; correct = success-credit
// every mold present on the answered question's distractors.

const DAY_MS = 86_400_000;
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const SUCCESS_QUALITY = 5; // confident correct; keeps SM-2 ease drift mild

export interface AttemptEvent {
  question_id: string;
  correct: boolean;
  bitten_mold: string | null; // selected choice's c3_mold_code (null if none/correct)
  attempted_at_ms: number;    // ordered ascending by caller
}

export interface MoldSrs {
  reps: number;
  lapses: number;
  ease: number;
  interval_days: number;
  last_reviewed_ms: number;
  due_at_ms: number;
}

function fresh(): MoldSrs {
  return { reps: 0, lapses: 0, ease: DEFAULT_EASE, interval_days: 0, last_reviewed_ms: 0, due_at_ms: 0 };
}

function applySuccess(s: MoldSrs, atMs: number): void {
  s.reps += 1;
  s.interval_days = s.reps === 1 ? 1 : s.reps === 2 ? 6 : Math.round(s.interval_days * s.ease);
  const q = SUCCESS_QUALITY;
  s.ease = Math.max(MIN_EASE, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  s.last_reviewed_ms = atMs;
  s.due_at_ms = atMs + s.interval_days * DAY_MS;
}

function applyLapse(s: MoldSrs, atMs: number): void {
  s.reps = 0; s.lapses += 1; s.interval_days = 1;
  s.ease = Math.max(MIN_EASE, s.ease - 0.2);
  s.last_reviewed_ms = atMs;
  s.due_at_ms = atMs + DAY_MS;
}

export function computeSrsState(
  events: AttemptEvent[],
  questionMolds: Record<string, string[]>,
): Map<string, MoldSrs> {
  const state = new Map<string, MoldSrs>();
  const get = (mold: string): MoldSrs => {
    let s = state.get(mold);
    if (!s) { s = fresh(); state.set(mold, s); }
    return s;
  };
  for (const e of events) {
    if (e.correct) {
      for (const mold of questionMolds[e.question_id] ?? []) applySuccess(get(mold), e.attempted_at_ms);
    } else if (e.bitten_mold) {
      applyLapse(get(e.bitten_mold), e.attempted_at_ms);
    }
  }
  return state;
}

// A mold with no SRS row has never been reviewed -> due. Otherwise due when now >= due_at.
export function isDue(state: Map<string, MoldSrs>, mold: string, nowMs: number): boolean {
  const s = state.get(mold);
  if (!s) return true;
  return nowMs >= s.due_at_ms;
}

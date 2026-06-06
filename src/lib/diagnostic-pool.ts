// Pure subject-aware diagnostic selection: the hard-set questions (in order)
// followed by N questions drawn from the random group, preferring subjects not
// already covered by the hard-set so all MBE subjects appear in most runs.
//
// The pool registry is generated from BARMATRIX/engineering/diagnostic-pool/pool.json
// by scripts/ingest_diagnostic_pool.py (see ./diagnostic-pool.data.ts). This module
// is pure + RNG-injectable so it is deterministic under test and so Phase 3 can wire
// it into the unified /api/diagnostic engine without behavioural surprises.
import {
  type DiagnosticPoolEntry,
  RANDOM_PULL_COUNT,
} from "./diagnostic-pool.data.js";

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Build one diagnostic's ordered list of question external ids:
 * the hard-set (sorted by `order`) followed by `pullCount` random-group questions
 * chosen subject-first. Bench questions are never served.
 */
export function selectDiagnosticPool(
  pool: DiagnosticPoolEntry[],
  rng: () => number,
  pullCount: number = RANDOM_PULL_COUNT,
): string[] {
  const hardSet = pool
    .filter((q) => q.role === "hard_set")
    .sort((a, b) => a.order - b.order);
  const random = shuffle(pool.filter((q) => q.role === "random"), rng);

  const covered = new Set(hardSet.map((q) => q.subject));
  const picked: DiagnosticPoolEntry[] = [];
  const pickedIds = new Set<string>();

  // Pass 1: prefer subjects not yet covered by the hard-set.
  for (const q of random) {
    if (picked.length >= pullCount) break;
    if (!covered.has(q.subject) && !pickedIds.has(q.externalId)) {
      picked.push(q);
      pickedIds.add(q.externalId);
      covered.add(q.subject);
    }
  }
  // Pass 2: fill remaining slots with anything left in the random group.
  for (const q of random) {
    if (picked.length >= pullCount) break;
    if (!pickedIds.has(q.externalId)) {
      picked.push(q);
      pickedIds.add(q.externalId);
    }
  }

  return [...hardSet, ...picked].map((q) => q.externalId);
}

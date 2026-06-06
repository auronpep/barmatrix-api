// Diagnostic results engine — pure, DB-free aggregation so it is unit-testable
// without a live MySQL connection (mirrors the knowledge route's helper split).
//
// The route layer fetches one row per attempt in a diagnostic session (keyed by
// student_attempts.set_id = diagnostic_id) and hands the rows here. We compute:
//   - a score summary (correct/total, %, avg confidence, avg time, HC misses)
//   - per-dimension red zones (subject / subtopic / tension_point + the
//     wrong-answer architecture derived from the SELECTED choice's forensic_tags)
//   - a flattened, ranked top_trap_patterns list (the "top 5 trap families")
//
// This is the anonymous-safe, ENROLLMENT-FREE Red-Zone *preview*. It is computed
// on the fly and never written to user_red_zones (that table stays the gated,
// persistent surface populated only for enrolled/identified students).
//
// proficiency_score matches src/lib/redzones.ts exactly:
//   correct / (attempts + high_confidence_wrong)   (0 when denominator is 0)
// A high-confidence wrong (confidence >= 4 on a miss) is penalized twice.

import { snakeToTitle } from "./format.js";

export const HIGH_CONFIDENCE_THRESHOLD = 4;
export const MAX_ZONES_PER_DIMENSION = 5;
export const TOP_TRAP_PATTERNS_LIMIT = 5;

// forensic_tags entries that are bookkeeping, not trap architectures.
const META_FORENSIC_TAGS = new Set(["correct_answer", "correct", ""]);

// Dimensions sourced from scalar question columns. Order here is the order they
// appear in the response's by_dimension map.
const COLUMN_DIMENSIONS = ["subject", "subtopic", "tension_point"] as const;
type ColumnDimension = (typeof COLUMN_DIMENSIONS)[number];

const TRAP_DIMENSION = "wrong_answer_architecture";

/** One attempt in a diagnostic session, already joined to its question + choice. */
export interface DiagnosticAttemptRow {
  correct: boolean | 0 | 1;
  confidence: number | null;
  time_seconds: number | null;
  subject: string | null;
  subtopic: string | null;
  tension_point: string | null;
  /** forensic_tags of the SELECTED choice, already parsed to a string[]. */
  selected_forensic_tags: string[];
}

// One reusable rule the diagnostic taker now owns — the "you learned this" win
// moment (experience spec G5). Sourced from questions.metadata.anchor_card,
// seeded per item. Theming lives only in example names, never the rule itself.
export interface AnchorCard {
  id: string;
  title: string | null;
  rule: string;
  prompt: string | null;
  source_tag: string;
  subject: string;
}

/** Minimal row shape needed to surface an anchor: the question's JSON-TEXT
 *  metadata (NEVER CAST AS JSON on MariaDB), external id, and subject. */
export interface AnchorSourceRow {
  metadata: string | null;
  external_id: string | null;
  subject: string | null;
}

// Pure: parse each answered question's metadata TEXT, pull anchor_card, and
// build a deduped list of rules the user now owns. Drops cards with no rule
// (null front+back) so the close only ever shows something concrete to keep.
export function extractDiagnosticAnchors(rows: AnchorSourceRow[]): AnchorCard[] {
  const out: AnchorCard[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.metadata) continue;
    let meta: unknown;
    try {
      meta = JSON.parse(r.metadata);
    } catch {
      continue;
    }
    if (!meta || typeof meta !== "object") continue;
    const card = (meta as Record<string, unknown>).anchor_card;
    if (!card || typeof card !== "object") continue;
    const c = card as Record<string, unknown>;
    const id = typeof c.id === "string" ? c.id : "";
    const back = typeof c.back === "string" ? c.back.trim() : "";
    const front = typeof c.front === "string" ? c.front.trim() : "";
    const rule = back || front;
    if (!id || !rule || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: typeof c.title === "string" ? c.title : null,
      rule,
      prompt: front || null,
      source_tag: r.external_id ?? "",
      subject: r.subject ?? "",
    });
  }
  return out;
}

export interface RedZoneEntry {
  tag: string;
  proficiency_score: number;
  attempts: number;
  high_confidence_wrongs: number;
  /** Representative subject — only attached for the trap dimension. */
  subject?: string;
}

export interface TopTrapPattern {
  rank: number;
  dimension: string;
  tag: string;
  label: string;
  subject: string | null;
  proficiency_score: number;
  attempts: number;
  high_confidence_wrongs: number;
  severity: "high" | "medium";
}

export interface DiagnosticSummary {
  correct: number;
  total: number;
  score_pct: number;
  avg_confidence: number;
  avg_time_seconds: number;
  high_confidence_misses: number;
}

export interface DiagnosticResults {
  answered: number;
  summary: DiagnosticSummary;
  red_zones: { by_dimension: Record<string, RedZoneEntry[]> };
  top_trap_patterns: TopTrapPattern[];
}

interface TagAccumulator {
  attempts: number;
  correct: number;
  highConfidenceWrongs: number;
  subjectCounts: Map<string, number>;
}

function isCorrect(row: DiagnosticAttemptRow): boolean {
  return row.correct === true || row.correct === 1;
}

function isHighConfidence(confidence: number | null): boolean {
  return typeof confidence === "number" && confidence >= HIGH_CONFIDENCE_THRESHOLD;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyAccumulator(): TagAccumulator {
  return { attempts: 0, correct: 0, highConfidenceWrongs: 0, subjectCounts: new Map() };
}

function bumpSubject(acc: TagAccumulator, subject: string | null): void {
  if (!subject) return;
  acc.subjectCounts.set(subject, (acc.subjectCounts.get(subject) ?? 0) + 1);
}

function representativeSubject(acc: TagAccumulator): string | null {
  let best: string | null = null;
  let bestCount = 0;
  // Deterministic: highest count, ties broken by lexical order.
  for (const [subject, count] of [...acc.subjectCounts.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  )) {
    if (count > bestCount) {
      best = subject;
      bestCount = count;
    }
  }
  return best;
}

function proficiency(acc: TagAccumulator): number {
  const denom = acc.attempts + acc.highConfidenceWrongs;
  return denom > 0 ? acc.correct / denom : 0;
}

function toEntry(tag: string, acc: TagAccumulator, withSubject: boolean): RedZoneEntry {
  const entry: RedZoneEntry = {
    tag,
    proficiency_score: proficiency(acc),
    attempts: acc.attempts,
    high_confidence_wrongs: acc.highConfidenceWrongs,
  };
  if (withSubject) {
    const subject = representativeSubject(acc);
    if (subject) entry.subject = subject;
  }
  return entry;
}

// Worst-first ordering for proficiency-bearing dimensions — identical priority
// to the existing results page comparator: HC wrongs desc, proficiency asc,
// attempts desc, then tag asc for stability.
function compareProficiencyDimension(a: RedZoneEntry, b: RedZoneEntry): number {
  if (b.high_confidence_wrongs !== a.high_confidence_wrongs) {
    return b.high_confidence_wrongs - a.high_confidence_wrongs;
  }
  if (a.proficiency_score !== b.proficiency_score) {
    return a.proficiency_score - b.proficiency_score;
  }
  if (b.attempts !== a.attempts) return b.attempts - a.attempts;
  return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
}

// Trap architectures have no "correct" by construction, so rank by how often the
// student fell into them: attempts desc, HC wrongs desc, tag asc.
function compareTrapDimension(a: RedZoneEntry, b: RedZoneEntry): number {
  if (b.attempts !== a.attempts) return b.attempts - a.attempts;
  if (b.high_confidence_wrongs !== a.high_confidence_wrongs) {
    return b.high_confidence_wrongs - a.high_confidence_wrongs;
  }
  return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
}

function humanizeTag(tag: string): string {
  // snake_case forensic tags humanize cleanly; free-form subtopics are left
  // as-authored when they are not snake_case.
  return tag.includes("_") ? snakeToTitle(tag) : tag;
}

function severityForTrap(entry: RedZoneEntry): "high" | "medium" {
  return entry.high_confidence_wrongs >= 1 || entry.attempts >= 2 ? "high" : "medium";
}

function severityForProficiency(entry: RedZoneEntry): "high" | "medium" {
  return entry.proficiency_score < 0.5 ? "high" : "medium";
}

/**
 * Aggregate a diagnostic session's attempt rows into a score summary + Red-Zone
 * preview. Pure: no IO, deterministic, safe to unit test without a database.
 */
export function computeDiagnosticResults(rows: DiagnosticAttemptRow[]): DiagnosticResults {
  const total = rows.length;

  // --- summary ---
  let correctCount = 0;
  let confidenceSum = 0;
  let timeSum = 0;
  let highConfidenceMisses = 0;
  for (const row of rows) {
    const right = isCorrect(row);
    if (right) correctCount += 1;
    confidenceSum += row.confidence ?? 0;
    timeSum += row.time_seconds ?? 0;
    if (!right && isHighConfidence(row.confidence)) highConfidenceMisses += 1;
  }
  const summary: DiagnosticSummary = {
    correct: correctCount,
    total,
    score_pct: total > 0 ? Math.round((correctCount / total) * 100) : 0,
    avg_confidence: total > 0 ? round1(confidenceSum / total) : 0,
    avg_time_seconds: total > 0 ? Math.round(timeSum / total) : 0,
    high_confidence_misses: highConfidenceMisses,
  };

  // --- accumulate dimensions ---
  const columnAccumulators: Record<ColumnDimension, Map<string, TagAccumulator>> = {
    subject: new Map(),
    subtopic: new Map(),
    tension_point: new Map(),
  };
  const trapAccumulators = new Map<string, TagAccumulator>();

  for (const row of rows) {
    const right = isCorrect(row);
    const hcWrong = !right && isHighConfidence(row.confidence);

    for (const dimension of COLUMN_DIMENSIONS) {
      const value = row[dimension];
      if (!value) continue;
      const map = columnAccumulators[dimension];
      const acc = map.get(value) ?? emptyAccumulator();
      acc.attempts += 1;
      if (right) acc.correct += 1;
      if (hcWrong) acc.highConfidenceWrongs += 1;
      bumpSubject(acc, row.subject);
      map.set(value, acc);
    }

    // Trap architecture is sourced only from MISSED attempts' selected tags.
    if (!right) {
      const seen = new Set<string>();
      for (const rawTag of row.selected_forensic_tags) {
        const tag = typeof rawTag === "string" ? rawTag.trim() : "";
        if (!tag || META_FORENSIC_TAGS.has(tag) || seen.has(tag)) continue;
        seen.add(tag);
        const acc = trapAccumulators.get(tag) ?? emptyAccumulator();
        acc.attempts += 1;
        if (hcWrong) acc.highConfidenceWrongs += 1;
        bumpSubject(acc, row.subject);
        trapAccumulators.set(tag, acc);
      }
    }
  }

  // --- shape by_dimension (omit empty dimensions) ---
  const byDimension: Record<string, RedZoneEntry[]> = {};
  for (const dimension of COLUMN_DIMENSIONS) {
    const entries = [...columnAccumulators[dimension].entries()]
      .map(([tag, acc]) => toEntry(tag, acc, false))
      .sort(compareProficiencyDimension)
      .slice(0, MAX_ZONES_PER_DIMENSION);
    if (entries.length > 0) byDimension[dimension] = entries;
  }
  const trapEntries = [...trapAccumulators.entries()]
    .map(([tag, acc]) => toEntry(tag, acc, true))
    .sort(compareTrapDimension)
    .slice(0, MAX_ZONES_PER_DIMENSION);
  if (trapEntries.length > 0) byDimension[TRAP_DIMENSION] = trapEntries;

  // --- top trap patterns: prefer real wrong-answer architectures, fall back to
  //     worst subtopics that actually had misses, else clean sweep ([]) ---
  let patternSource: { dimension: string; entries: RedZoneEntry[] };
  if (trapEntries.length > 0) {
    patternSource = { dimension: TRAP_DIMENSION, entries: trapEntries };
  } else {
    // Rebuild subtopic entries WITH a representative subject (the by_dimension
    // copies omit it) for the pattern cards. proficiency_score < 1 means the
    // subtopic had at least one miss (all-correct subtopics score exactly 1.0),
    // so these are the real weak spots.
    const subtopicMisses = [...columnAccumulators.subtopic.entries()]
      .map(([tag, acc]) => toEntry(tag, acc, true))
      .filter((e) => e.proficiency_score < 1)
      .sort(compareProficiencyDimension);
    patternSource = { dimension: "subtopic", entries: subtopicMisses };
  }

  const topTrapPatterns: TopTrapPattern[] = patternSource.entries
    .slice(0, TOP_TRAP_PATTERNS_LIMIT)
    .map((entry, index) => ({
      rank: index + 1,
      dimension: patternSource.dimension,
      tag: entry.tag,
      label: humanizeTag(entry.tag),
      subject: entry.subject ?? null,
      proficiency_score: entry.proficiency_score,
      attempts: entry.attempts,
      high_confidence_wrongs: entry.high_confidence_wrongs,
      severity:
        patternSource.dimension === TRAP_DIMENSION
          ? severityForTrap(entry)
          : severityForProficiency(entry),
    }));

  return {
    answered: total,
    summary,
    red_zones: { by_dimension: byDimension },
    top_trap_patterns: topTrapPatterns,
  };
}

// ---------------------------------------------------------------------------
// Trap-weighted question selection
// ---------------------------------------------------------------------------

export const DIAGNOSTIC_LENGTH = 20;
// Candidate pool the route pulls (ordered by attractiveness DESC, RAND()). Big
// enough that subject-spread has room to work and retakes vary, small enough to
// keep the pick query cheap.
export const DIAGNOSTIC_POOL_SIZE = 60;

/** A selectable question + its trap-attractiveness signal (0 when unknown). */
export interface DiagnosticCandidate {
  question_id: string;
  subject: string | null;
  /** Max distractor focus-group pct (excluding the correct letter); 0 if none. */
  attractiveness: number;
}

/**
 * Pick up to `n` question ids from a candidate pool, preserving the pool's given
 * order (the route orders by attractiveness DESC, then RAND()) while spreading
 * across subjects so one diagnostic spans the bar instead of clustering in a
 * single subject.
 *
 * Pure and deterministic given the input order — turn-to-turn variety comes from
 * the SQL RAND() tiebreak, not from this function, which keeps it unit-testable.
 *
 * Pass 1 takes a candidate only while its subject is under `maxPerSubject`.
 * Pass 2 fills any shortfall ignoring the cap. Dedupes by question_id. Returns
 * fewer than `n` only when the pool itself is smaller.
 */
export function selectDiagnosticQuestionIds(
  candidates: DiagnosticCandidate[],
  n: number = DIAGNOSTIC_LENGTH,
  maxPerSubject: number = Math.max(2, Math.ceil(n / 6)),
): string[] {
  const picked: string[] = [];
  const pickedIds = new Set<string>();
  const perSubject = new Map<string, number>();

  const take = (c: DiagnosticCandidate): void => {
    picked.push(c.question_id);
    pickedIds.add(c.question_id);
    const key = c.subject ?? "";
    perSubject.set(key, (perSubject.get(key) ?? 0) + 1);
  };

  // Pass 1 — subject-spread within the cap.
  for (const c of candidates) {
    if (picked.length >= n) break;
    if (!c.question_id || pickedIds.has(c.question_id)) continue;
    if ((perSubject.get(c.subject ?? "") ?? 0) >= maxPerSubject) continue;
    take(c);
  }

  // Pass 2 — fill the remainder ignoring the cap.
  if (picked.length < n) {
    for (const c of candidates) {
      if (picked.length >= n) break;
      if (!c.question_id || pickedIds.has(c.question_id)) continue;
      take(c);
    }
  }

  return picked;
}

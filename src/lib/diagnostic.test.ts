import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

import {
  computeDiagnosticResults,
  dedupeAttemptsByLatest,
  selectDiagnosticQuestionIds,
  type DiagnosticAttemptRow,
  type DiagnosticCandidate,
  type RawDiagnosticAttemptRow,
} from "./diagnostic.js";
import {
  DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR,
  buildFixedDiagnosticQuestionSelection,
  loadAmbassadorDiagnosticSources,
  shapeDiagnosticRecommendation,
  toDiagnosticAttemptRow,
} from "./ambassador-diagnostic.js";

// --- helpers ---------------------------------------------------------------

function rawAttempt(
  question_id: string,
  attempted_at: string,
  overrides: Partial<DiagnosticAttemptRow> = {},
): RawDiagnosticAttemptRow {
  return {
    question_id,
    attempted_at,
    correct: false,
    confidence: 3,
    time_seconds: 30,
    subject: "Evidence",
    subtopic: "Hearsay",
    tension_point: "effect_on_listener",
    selected_forensic_tags: [],
    ...overrides,
  };
}

function attempt(overrides: Partial<DiagnosticAttemptRow> = {}): DiagnosticAttemptRow {
  return {
    correct: false,
    confidence: 3,
    time_seconds: 30,
    subject: "Evidence",
    subtopic: "Hearsay",
    tension_point: "effect_on_listener",
    selected_forensic_tags: [],
    ...overrides,
  };
}

function candidate(
  id: string,
  subject: string | null,
  attractiveness = 0,
): DiagnosticCandidate {
  return { question_id: id, subject, attractiveness };
}

// --- computeDiagnosticResults ----------------------------------------------

describe("computeDiagnosticResults", () => {
  // A 4-question session: 2 correct, 2 wrong (one a high-confidence miss).
  const rows: DiagnosticAttemptRow[] = [
    attempt({
      subject: "Evidence",
      subtopic: "Hearsay",
      tension_point: "tp1",
      correct: 1,
      confidence: 5,
      time_seconds: 30,
    }),
    attempt({
      subject: "Evidence",
      subtopic: "Hearsay",
      tension_point: "tp1",
      correct: 0,
      confidence: 5, // high-confidence miss
      time_seconds: 60,
      selected_forensic_tags: ["legally_true_but_irrelevant", "correct_answer"],
    }),
    attempt({
      subject: "Torts",
      subtopic: "Negligence",
      tension_point: "tp2",
      correct: 0,
      confidence: 2, // low-confidence miss
      time_seconds: 40,
      selected_forensic_tags: ["wrong_standard"],
    }),
    attempt({
      subject: "Torts",
      subtopic: "Negligence",
      tension_point: "tp2",
      correct: 1,
      confidence: 3,
      time_seconds: 20,
    }),
  ];

  const result = computeDiagnosticResults(rows);

  it("computes the score summary (count, %, averages, HC misses)", () => {
    assert.equal(result.answered, 4);
    assert.equal(result.summary.correct, 2);
    assert.equal(result.summary.total, 4);
    assert.equal(result.summary.score_pct, 50);
    assert.equal(result.summary.avg_confidence, 3.8); // (5+5+2+3)/4 = 3.75 -> 3.8
    assert.equal(result.summary.avg_time_seconds, 38); // 150/4 = 37.5 -> 38
    assert.equal(result.summary.high_confidence_misses, 1); // only the conf-5 miss
  });

  it("matches the redzones.ts proficiency formula correct/(attempts+hc_wrong)", () => {
    const subjects = result.red_zones.by_dimension.subject ?? [];
    const evidence = subjects.find((e) => e.tag === "Evidence");
    const torts = subjects.find((e) => e.tag === "Torts");
    assert.ok(evidence && torts);
    // Evidence: 1 correct / (2 attempts + 1 hc_wrong) = 1/3
    assert.ok(Math.abs((evidence as { proficiency_score: number }).proficiency_score - 1 / 3) < 1e-9);
    // Torts: 1 correct / (2 attempts + 0 hc_wrong) = 0.5
    assert.equal((torts as { proficiency_score: number }).proficiency_score, 0.5);
  });

  it("orders proficiency dimensions worst-first (HC wrongs, then proficiency)", () => {
    const subjects = result.red_zones.by_dimension.subject ?? [];
    assert.equal(subjects[0]?.tag, "Evidence"); // higher HC wrongs -> first
    assert.equal(subjects[1]?.tag, "Torts");
  });

  it("derives wrong_answer_architecture only from misses and excludes meta tags", () => {
    const arch = result.red_zones.by_dimension.wrong_answer_architecture ?? [];
    const tags = arch.map((e) => e.tag);
    assert.ok(tags.includes("legally_true_but_irrelevant"));
    assert.ok(tags.includes("wrong_standard"));
    assert.ok(!tags.includes("correct_answer"), "meta tag must be excluded");
    const ltbi = arch.find((e) => e.tag === "legally_true_but_irrelevant");
    assert.equal(ltbi?.attempts, 1);
    assert.equal(ltbi?.high_confidence_wrongs, 1);
    assert.equal(ltbi?.subject, "Evidence"); // representative subject of the miss
  });

  it("surfaces top_trap_patterns from the architecture dimension with severity", () => {
    assert.equal(result.top_trap_patterns.length, 2);
    const first = result.top_trap_patterns[0];
    assert.equal(first?.rank, 1);
    assert.equal(first?.dimension, "wrong_answer_architecture");
    assert.equal(first?.tag, "legally_true_but_irrelevant");
    assert.equal(first?.label, "Legally True But Irrelevant");
    assert.equal(first?.subject, "Evidence");
    assert.equal(first?.severity, "high"); // has a high-confidence wrong
    assert.equal(result.top_trap_patterns[1]?.severity, "medium"); // 1 attempt, no HC
  });

  it("returns a zeroed, empty result for a session with no attempts", () => {
    const empty = computeDiagnosticResults([]);
    assert.equal(empty.answered, 0);
    assert.deepEqual(empty.summary, {
      correct: 0,
      total: 0,
      score_pct: 0,
      avg_confidence: 0,
      avg_time_seconds: 0,
      high_confidence_misses: 0,
    });
    assert.deepEqual(empty.red_zones.by_dimension, {});
    assert.deepEqual(empty.top_trap_patterns, []);
  });

  it("returns no trap patterns on a clean sweep (all correct)", () => {
    const clean = computeDiagnosticResults([
      attempt({ subject: "Contracts", subtopic: "Offer", correct: 1, confidence: 4 }),
      attempt({ subject: "Contracts", subtopic: "Offer", correct: 1, confidence: 5 }),
    ]);
    assert.deepEqual(clean.top_trap_patterns, []);
    assert.equal(clean.red_zones.by_dimension.wrong_answer_architecture, undefined);
    const subjects = clean.red_zones.by_dimension.subject ?? [];
    assert.equal(subjects[0]?.proficiency_score, 1);
  });

  it("falls back to worst subtopics when misses carry no forensic tags", () => {
    const noTags = computeDiagnosticResults([
      attempt({ subject: "Contracts", subtopic: "Offer", correct: 0, confidence: 4, selected_forensic_tags: [] }),
      attempt({ subject: "Contracts", subtopic: "Offer", correct: 1, confidence: 3, selected_forensic_tags: [] }),
      attempt({ subject: "Contracts", subtopic: "Acceptance", correct: 1, confidence: 5, selected_forensic_tags: [] }),
    ]);
    assert.equal(noTags.red_zones.by_dimension.wrong_answer_architecture, undefined);
    assert.equal(noTags.top_trap_patterns.length, 1);
    const pattern = noTags.top_trap_patterns[0];
    assert.equal(pattern?.dimension, "subtopic");
    assert.equal(pattern?.tag, "Offer"); // Acceptance was all-correct, excluded
    assert.equal(pattern?.subject, "Contracts");
    assert.equal(pattern?.severity, "high"); // proficiency 1/3 < 0.5
  });
});

// --- selectDiagnosticQuestionIds -------------------------------------------

describe("selectDiagnosticQuestionIds", () => {
  it("spreads across subjects under the default per-subject cap", () => {
    const pool = [
      candidate("e1", "Evidence", 9),
      candidate("e2", "Evidence", 8),
      candidate("e3", "Evidence", 7),
      candidate("t1", "Torts", 6),
      candidate("t2", "Torts", 5),
      candidate("c1", "Contracts", 4),
    ];
    // n=4 -> default maxPerSubject = max(2, ceil(4/6)) = 2
    assert.deepEqual(selectDiagnosticQuestionIds(pool, 4), ["e1", "e2", "t1", "t2"]);
  });

  it("fills the shortfall ignoring the cap (pass 2)", () => {
    const pool = [
      candidate("a1", "Evidence", 5),
      candidate("a2", "Evidence", 4),
      candidate("a3", "Evidence", 3),
      candidate("a4", "Evidence", 2),
    ];
    // n=3, default cap 2 -> pass1 takes a1,a2; pass2 fills a3
    assert.deepEqual(selectDiagnosticQuestionIds(pool, 3), ["a1", "a2", "a3"]);
  });

  it("honors an explicit maxPerSubject cap", () => {
    const pool = [
      candidate("e1", "Evidence", 9),
      candidate("e2", "Evidence", 8),
      candidate("t1", "Torts", 7),
    ];
    assert.deepEqual(selectDiagnosticQuestionIds(pool, 2, 1), ["e1", "t1"]);
  });

  it("dedupes repeated question ids", () => {
    const pool = [
      candidate("q1", "Evidence", 9),
      candidate("q1", "Evidence", 9),
      candidate("q2", "Torts", 8),
    ];
    assert.deepEqual(selectDiagnosticQuestionIds(pool, 4), ["q1", "q2"]);
  });

  it("returns the whole pool when it is smaller than n", () => {
    const pool = [candidate("q1", "Evidence", 1), candidate("q2", "Torts", 0)];
    assert.deepEqual(selectDiagnosticQuestionIds(pool, 12), ["q1", "q2"]);
  });

  it("still selects (with spread) when there is no attractiveness signal", () => {
    // attractiveness all 0 simulates the no-focus-group fallback; the route's
    // RAND() decides order, this fn just preserves it + spreads subjects.
    const pool = [
      candidate("x", "S1", 0),
      candidate("y", "S2", 0),
      candidate("z", "S1", 0),
    ];
    assert.deepEqual(selectDiagnosticQuestionIds(pool, 2), ["x", "y"]);
  });
});

// This test loads and parses the 20 ambassador diagnostic source files.
// Set AMBASSADOR_DIAGNOSTIC_SOURCE_DIR or the test will be skipped.
const ambassadorSourceDir = DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR;

describe(
  "ambassador diagnostic end-to-end contract",
  { skip: !existsSync(ambassadorSourceDir) ? `source dir not found: ${ambassadorSourceDir}` : false },
  () => {
    it("starts with the fixed 20 ids, computes red zones, and returns a recommendation", () => {
    const selection = buildFixedDiagnosticQuestionSelection();
    assert.match(selection.sql, /q\.status = 'diagnostic'/);
    assert.equal(selection.values.length, 40);

    const questions = loadAmbassadorDiagnosticSources();
    const attempts = [
      toDiagnosticAttemptRow(questions[0]!, "C", 5),
      toDiagnosticAttemptRow(questions[1]!, "C", 4),
      toDiagnosticAttemptRow(questions[2]!, "B", 5),
      ...questions.slice(3).map((question) =>
        toDiagnosticAttemptRow(question, question.correct_answer, 3),
      ),
    ];

    const results = computeDiagnosticResults(attempts);
    const recommendation = shapeDiagnosticRecommendation(results);

    assert.equal(results.answered, 20);
    assert.equal(results.summary.correct, 17);
    assert.ok(results.top_trap_patterns.length >= 1);
    assert.equal(results.top_trap_patterns[0]?.tag, "bait_doctrine");
    assert.equal(recommendation.level.level, 4);
    assert.equal(recommendation.next_step.primary_label, "Start The Method");
    assert.equal(recommendation.next_step.href, "/foundations/lesson-01");
    });
  }
);

// --- dedupeAttemptsByLatest ------------------------------------------------
// Validates the contract that mirrors the SQL-level MAX(attempted_at) dedupe
// in the diagnostic results query. Without this dedupe, a 20-question session
// with re-submitted answers returns answered > 20 (the P1 bug).

describe("dedupeAttemptsByLatest", () => {
  it("returns one row per question_id, keeping the latest attempted_at", () => {
    const rows = [
      rawAttempt("q1", "2026-01-01T10:00:00Z", { correct: false }),
      rawAttempt("q1", "2026-01-01T10:01:00Z", { correct: true }), // retry — keep this
      rawAttempt("q2", "2026-01-01T10:02:00Z", { correct: false }),
    ];
    const deduped = dedupeAttemptsByLatest(rows);
    assert.equal(deduped.length, 2);
    const q1 = deduped.find((r) => r.question_id === "q1");
    assert.ok(q1);
    assert.equal(q1.correct, true, "latest attempt (correct=true) must win over earlier miss");
    assert.equal(q1.attempted_at, "2026-01-01T10:01:00Z");
  });

  it("with no duplicates, returns all rows unchanged", () => {
    const rows = [
      rawAttempt("q1", "2026-01-01T10:00:00Z"),
      rawAttempt("q2", "2026-01-01T10:01:00Z"),
      rawAttempt("q3", "2026-01-01T10:02:00Z"),
    ];
    const deduped = dedupeAttemptsByLatest(rows);
    assert.equal(deduped.length, 3);
  });

  it("prevents answered inflation: 20q session with 3 re-submits stays at 20", () => {
    // Simulate a 20-question diagnostic session where q1, q2, q3 were answered twice.
    const base = Array.from({ length: 20 }, (_, i) =>
      rawAttempt(`q${i + 1}`, `2026-01-01T10:${String(i).padStart(2, "0")}:00Z`, {
        correct: i % 2 === 0,
      }),
    );
    // Add re-submits for q1, q2, q3 with later timestamps
    const resubmits = [
      rawAttempt("q1", "2026-01-01T10:30:00Z", { correct: true }),
      rawAttempt("q2", "2026-01-01T10:31:00Z", { correct: false }),
      rawAttempt("q3", "2026-01-01T10:32:00Z", { correct: true }),
    ];
    const allRows = [...base, ...resubmits]; // 23 raw rows
    assert.equal(allRows.length, 23, "raw rows include the re-submits");
    const deduped = dedupeAttemptsByLatest(allRows);
    assert.equal(deduped.length, 20, "answered must be 20 after dedupe, not 23");
    const results = computeDiagnosticResults(deduped);
    assert.equal(results.answered, 20, "computeDiagnosticResults.answered must equal 20");
  });

  it("handles an empty input", () => {
    assert.deepEqual(dedupeAttemptsByLatest([]), []);
  });
});

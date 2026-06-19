import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDebriefData,
  parseDominantTrap,
  type AkAnnotationRow,
  type AkChoiceRow,
  type AkQuestionRow,
} from "./answer-key-data.js";

const Q: AkQuestionRow = {
  question_id: "31a57b60-6a31-11f1-a7ad-f9e8a06a2fad",
  external_id: "17027_heritage_plow_fraud",
  subject: "CIVIL_PROCEDURE",
  topic: "Erie Doctrine",
  subtopic: "State burden of proof",
  tension_point: "erie_substance_vs_procedure",
  fact_pattern: "Mary bought a plow.",
  question_stem: "Mary moved in limine.",
  call_of_question: "Which burden of proof applies at trial?",
  difficulty: null,
  metadata: { outline_code: "96060100", c3_confidence: "ANCHOR_ASSISTED" },
};

const CHOICES: AkChoiceRow[] = [
  { letter: "A", choice_text: "Federal preponderance.", is_correct: 0,
    why_attractive: "Flat overclaim.", why_wrong_or_correct: "Overclaims federal procedure.",
    future_cue: "Check substance vs procedure.", remediation_id: "RC-ERIE-01",
    forensic_tags: null, misconception_tags: null,
    c3_filter_broken: "NOT_TRUE", c3_mold_code: "flat_misstatement", c3_architecture: null },
  { letter: "B", choice_text: "Whatever the defendant prefers.", is_correct: 0,
    why_attractive: "Recharacterizes Erie.", why_wrong_or_correct: "Erie is not party-preference.",
    future_cue: null, remediation_id: "RC-ERIE-01",
    forensic_tags: null, misconception_tags: null,
    c3_filter_broken: "NOT_RESPONSIVE", c3_mold_code: "misfit", c3_architecture: "wrong_frame" },
  { letter: "C", choice_text: "State clear-and-convincing.", is_correct: 1,
    why_attractive: null, why_wrong_or_correct: "Only choice mapping Erie to the burden.",
    future_cue: null, remediation_id: "RC-ERIE-01",
    forensic_tags: null, misconception_tags: null,
    c3_filter_broken: null, c3_mold_code: null, c3_architecture: null },
  { letter: "D", choice_text: "No burden at all.", is_correct: 0,
    why_attractive: "Asserts a non-rule.", why_wrong_or_correct: "Every claim has a burden.",
    future_cue: null, remediation_id: "RC-ERIE-01",
    forensic_tags: null, misconception_tags: null,
    c3_filter_broken: "NOT_TRUE", c3_mold_code: "fabricated_rule", c3_architecture: null },
];

const ANN: AkAnnotationRow = {
  verdict: "ANCHOR_SOLVE", residual: "C", agrees_with_key: 1, governing_law_type: "RULE",
  deciding_phase: "CALL", tension_axis_id: null, is_fork: 0, fork_type: null,
  call_heuristic: "Erie allocation of the burden", difficulty: 2,
  analyzer_notes: "drift_audit: ... dominant_trap: A, predicted seed. outline_code_verified: 96060100.",
};

describe("parseDominantTrap", () => {
  it("extracts the letter from analyzer_notes", () => {
    assert.equal(parseDominantTrap("foo dominant_trap: A, bar"), "A");
    assert.equal(parseDominantTrap("dominant_trap: c"), "C");
    assert.equal(parseDominantTrap("no trap here"), null);
    assert.equal(parseDominantTrap(null), null);
  });
});

describe("buildDebriefData", () => {
  const d = buildDebriefData(Q, CHOICES, ANN);

  it("identifies the credited answer and dominant trap", () => {
    assert.equal(d.correctLetter, "C");
    assert.equal(d.dominantTrap, "A");
    assert.equal(d.residual, "C");
  });

  it("uses external_id as qid and reads outline_code from metadata", () => {
    assert.equal(d.qid, "17027_heritage_plow_fraud");
    assert.equal(d.outlineCode, "96060100");
    assert.equal(d.governingLane, "RULE");
  });

  it("sorts the credited choice onto the asked branch, NOT_TRUE/NOT_RESPONSIVE onto the decoy", () => {
    const find = (l: string) => d.choices.find((c) => c.letter === l)!;
    assert.equal(find("C").keyType, "call"); // credited → asked side
    assert.equal(find("A").keyType, "bait"); // NOT_TRUE → decoy
    assert.equal(find("B").keyType, "expanded"); // NOT_RESPONSIVE → decoy
  });

  it("marks the dominant trap choice and exposes wrong-answer reasoning", () => {
    const a = d.choices.find((c) => c.letter === "A")!;
    assert.equal(a.dominant, true);
    assert.equal(a.correct, false);
    assert.equal(a.fullWrong, "Overclaims federal procedure.");
    assert.equal(a.recovery, "Check substance vs procedure.");
    const c = d.choices.find((c) => c.letter === "C")!;
    assert.equal(c.fullRight, "Only choice mapping Erie to the burden.");
  });

  it("derives callResolution + reviewTruth from the credited choice", () => {
    assert.equal(d.callResolution, "Only choice mapping Erie to the burden.");
    assert.equal(d.reviewTruth, "Only choice mapping Erie to the burden.");
  });

  it("builds a mold glossary from distinct wrong-answer molds", () => {
    const codes = d.molds.map((m) => m.code).sort();
    assert.deepEqual(codes, ["fabricated_rule", "flat_misstatement", "misfit"]);
    assert.equal(d.molds.every((m) => m.label.length > 0), true);
  });

  it("cuts every non-residual choice", () => {
    const letters = d.cut.map((c) => c.letter).sort();
    assert.deepEqual(letters, ["A", "B", "D"]);
  });

  it("degrades narrative fields to empty (not null) so the component can guard them", () => {
    assert.equal(d.goldKey.statement, "");
    assert.equal(d.silverKey.statement, "");
    assert.equal(d.tension.axis, "");
    assert.deepEqual(d.triggerFacts, []);
    assert.equal(d.requestedRelief, "");
  });

  it("tolerates a missing annotation", () => {
    const d2 = buildDebriefData(Q, CHOICES, null);
    assert.equal(d2.correctLetter, "C");
    assert.equal(d2.residual, "C"); // falls back to correct letter
    assert.equal(d2.dominantTrap, "A"); // falls back to first non-correct choice
  });
});

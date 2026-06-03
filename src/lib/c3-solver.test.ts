import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectMolds,
  analyzeQuestion,
  validateProposal,
  type SolverQuestion,
} from "./c3-solver.js";

describe("detectMolds", () => {
  it("detects overclaim absolutes", () => {
    const m = detectMolds("The defendant must always be liable in all cases.");
    assert.equal(m[0]?.mold_code, "tiered_absolute");
    assert.equal(m[0]?.family, "EAR_OVERCLAIM");
  });
  it("detects colloquial hedging", () => {
    const m = detectMolds("This is basically a contract, sort of.");
    assert.equal(m[0]?.mold_code, "colloquialism");
  });
  it("returns nothing for clean legal prose", () => {
    assert.deepEqual(detectMolds("A firm offer is irrevocable for the stated period."), []);
  });
});

const cleanCredited = "The offer is irrevocable for the stated period under UCC 2-205.";

describe("analyzeQuestion", () => {
  it("proposes PASS when credited is clean and all 3 distractors are tagged", () => {
    const q: SolverQuestion = {
      credited_answer: "B",
      choices: [
        { letter: "A", text: "The offer can never be revoked under any circumstances." }, // overclaim
        { letter: "B", text: cleanCredited },
        { letter: "C", text: "Consideration must always be present, without exception." }, // overclaim
        { letter: "D", text: "It is basically revocable, more or less." }, // colloquial
      ],
    };
    const p = analyzeQuestion(q);
    assert.equal(p.verdict, "PASS");
    assert.equal(p.deciding_phase, "CUT");
    assert.equal(p.confidence, "HEURISTIC_STRUCTURAL");
    assert.equal(p.residual, "B");
    assert.equal(p.agrees_with_key, true);
    assert.equal(p.distractors.length, 3);
    assert.deepEqual(validateProposal(p), { valid: true, errors: [] });
  });

  it("routes to NEEDS_HUMAN when a distractor has no detectable failure mode", () => {
    const q: SolverQuestion = {
      credited_answer: "B",
      choices: [
        { letter: "A", text: "The offer can never be revoked." },
        { letter: "B", text: cleanCredited },
        { letter: "C", text: "Consideration is required to form the option." }, // clean — undetectable
        { letter: "D", text: "It is basically revocable." },
      ],
    };
    const p = analyzeQuestion(q);
    assert.equal(p.verdict, "NEEDS_HUMAN");
    assert.equal(p.confidence, "HUMAN_REVIEW");
    assert.equal(p.residual, null);
  });

  it("routes to NEEDS_HUMAN when the credited answer itself triggers a detector", () => {
    const q: SolverQuestion = {
      credited_answer: "B",
      choices: [
        { letter: "A", text: "The offer can never be revoked." },
        { letter: "B", text: "The offer must always remain open forever." }, // credited triggers overclaim
        { letter: "C", text: "Consideration must always be present." },
        { letter: "D", text: "It is basically revocable." },
      ],
    };
    const p = analyzeQuestion(q);
    assert.equal(p.verdict, "NEEDS_HUMAN");
  });

  it("never auto-PASSes a malformed choice set", () => {
    const q: SolverQuestion = {
      credited_answer: "A",
      choices: [{ letter: "A", text: cleanCredited }],
    };
    assert.equal(analyzeQuestion(q).verdict, "NEEDS_HUMAN");
  });
});

describe("validateProposal", () => {
  it("rejects a PASS with the wrong distractor count", () => {
    const r = validateProposal({
      verdict: "PASS", deciding_phase: "CUT", confidence: "HEURISTIC_STRUCTURAL",
      residual: "B", agrees_with_key: true,
      distractors: [{ choice: "A", filter_broken: "NOT_TRUE", mold_code: "tiered_absolute" }],
      analyzer_notes: "",
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("exactly 3")));
  });

  it("rejects a residual that is also tagged as a distractor", () => {
    const r = validateProposal({
      verdict: "PASS", deciding_phase: "CUT", confidence: "HEURISTIC_STRUCTURAL",
      residual: "A", agrees_with_key: true,
      distractors: [
        { choice: "A", filter_broken: "NOT_TRUE", mold_code: "tiered_absolute" },
        { choice: "C", filter_broken: "NOT_TRUE", mold_code: "tiered_absolute" },
        { choice: "D", filter_broken: "NOT_TRUE", mold_code: "colloquialism" },
      ],
      analyzer_notes: "",
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("residual must not")));
  });
});

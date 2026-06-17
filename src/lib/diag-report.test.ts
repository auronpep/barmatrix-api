import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RemediationBundle } from "./diag-remediation.js";
import {
  assembleStudentReportPayload,
  type GradedResponse,
} from "./diag-report.js";

describe("diag-report", () => {
  const bundle: RemediationBundle = {
    bundle_id: "BUNDLE-RESET-FIXTURE",
    remediation_id: "RESET-FIXTURE",
    title: "Reset Fixture",
    status: "test_fixture",
    source_instances: [{ question_id: "DIAG-014", subject: "Civil Procedure" }],
    diagnostic_trigger: "Synthetic reset test fixture.",
    student_facing_diagnosis: "Synthetic reset report profile.",
    c3_profile: {
      route_family: "reset-fixture",
      failure_mode: "synthetic",
      c3_phase: "CUT",
      confidence_class: "mixed",
      primary_skill: "diagnostic-report",
      subjects: ["Civil Procedure"],
    },
    assigned_path: {
      lesson_route: ["lesson-01"],
      subject_overlay: "Synthetic overlay",
      tiny_anchor: "Synthetic anchor",
    },
    micro_sequence: [
      {
        step: 1,
        name: "Synthetic step",
        duration_minutes: 5,
        student_task: "Review the synthetic reset fixture.",
        success_check: "Fixture assembled.",
      },
    ],
    mastery_gate: "Synthetic gate",
    escalation: {},
  };

  const responses: GradedResponse[] = [
    {
      question_id: "DIAG-014",
      subject: "Civil Procedure",
      correct: false,
      confidence: 5, // overconfident wrong
      time_seconds: 40,
      selected_display_letter: "D",
      c3_phase: "CUT",
      diagnosis: "Overstated service contacts into general jurisdiction.",
    },
    {
      question_id: "DIAG-001",
      subject: "Evidence",
      correct: true,
      confidence: 1, // underconfident correct
      time_seconds: 55,
      selected_display_letter: "A",
    },
    {
      question_id: "DIAG-007",
      subject: "Civil Procedure",
      correct: false,
      confidence: 3,
      time_seconds: 30,
      selected_display_letter: "B",
      c3_phase: "CLASH",
    },
    {
      question_id: "DIAG-009",
      subject: "Evidence",
      correct: true,
      confidence: 4,
      time_seconds: 25,
      selected_display_letter: "C",
    },
  ];

  const payload = assembleStudentReportPayload({
    student_id: "stu_123",
    responses,
    bundle,
  });

  it("carries identity and version", () => {
    assert.equal(payload.student_id, "stu_123");
    assert.equal(payload.diagnostic_version, "DIAG_v1");
    assert.equal(payload.headline_profile, bundle.title);
  });

  it("computes raw_score and accuracy from the responses", () => {
    assert.equal(payload.score_summary.raw_score, 2);
    assert.equal(payload.score_summary.accuracy_pct, 0.5);
  });

  it("flags overconfident-wrong and underconfident-correct on the 1-5 scale", () => {
    const note = payload.score_summary.confidence_note;
    assert.match(note, /1 overconfident wrong/);
    assert.match(note, /1 underconfident correct/);
  });

  it("pulls assigned_route straight from the bundle", () => {
    assert.equal(payload.assigned_route.remediation_id, bundle.remediation_id);
    assert.equal(payload.assigned_route.bundle_id, bundle.bundle_id);
    assert.deepEqual(
      payload.assigned_route.lesson_route,
      bundle.assigned_path.lesson_route,
    );
    assert.equal(
      payload.assigned_route.subject_overlay,
      bundle.assigned_path.subject_overlay,
    );
    assert.equal(payload.assigned_route.tiny_anchor, bundle.assigned_path.tiny_anchor);
  });

  it("first_30_minute_assignment length matches micro_sequence", () => {
    assert.equal(
      payload.first_30_minute_assignment.length,
      bundle.micro_sequence.length,
    );
    // ranges are consecutive starting at 0
    const firstStep = payload.first_30_minute_assignment[0];
    assert.ok(firstStep);
    assert.match(firstStep.minute_range, /^0-/);
  });

  it("c3_phase_map has all three phases and counts misses", () => {
    assert.equal(payload.c3_phase_map.length, 3);
    const cut = payload.c3_phase_map.find((p) => p.phase === "CUT");
    const clash = payload.c3_phase_map.find((p) => p.phase === "CLASH");
    assert.equal(cut?.miss_count, 1);
    assert.equal(clash?.miss_count, 1);
    assert.ok(cut?.instructional_meaning.length);
  });

  it("subject_red_zones aggregates misses by subject", () => {
    const civpro = payload.subject_red_zones.find(
      (z) => z.subject === "Civil Procedure",
    );
    assert.equal(civpro?.misses, 2);
    assert.equal(civpro?.assigned_overlay, bundle.assigned_path.subject_overlay);
  });

  it("question_by_question_appendix has one row per response", () => {
    assert.equal(payload.question_by_question_appendix.length, responses.length);
    const first = payload.question_by_question_appendix[0];
    assert.ok(first);
    assert.equal(first.question_id, "DIAG-014");
    assert.equal(first.result, "wrong");
    assert.equal(first.student_pick, "D");
  });
});

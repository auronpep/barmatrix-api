import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLeadMeV5AssaultManifest,
  evaluateLeadMeV5Response,
} from "./leadme-v5-day-plan.js";

describe("buildLeadMeV5AssaultManifest", () => {
  it("maps V5 candidate set composition into the single live Lead Me module", () => {
    const manifest = buildLeadMeV5AssaultManifest({
      set: {
        identity: { set_id: "LMS-TORTS-64010101-ASSAULT", title: "Assault Router" },
        atlas_target: { primary_outline_code: "64010101", subject: "Torts" },
        delivery: { estimated_minutes: 10 },
        composition: {
          sequence: [
            {
              step_id: "second",
              item_id: "LMI-TORTS-64010101-ASSAULT-002",
              role: "repair",
              required: true,
              order_index: 2,
            },
            {
              step_id: "first",
              item_id: "LMI-TORTS-64010101-ASSAULT-001",
              role: "diagnose",
              required: true,
              order_index: 1,
            },
          ],
        },
      },
      items: [
        {
          identity: {
            item_id: "LMI-TORTS-64010101-ASSAULT-002",
            title: "Apparent ability repair",
            item_type: "red_zone_bridge",
          },
          source: { source_section_id: "64010101" },
          atlas: { primary_outline_code: "64010101" },
          content: {
            prompt: "Repair the apparent ability trap.",
            front_blocks: [{ type: "repair", markdown: "Use apparent ability, not actual ability." }],
          },
          task: { options: [{ id: "A", label: "Actual ability only" }] },
        },
        {
          identity: {
            item_id: "LMI-TORTS-64010101-ASSAULT-001",
            title: "Apprehension gate",
            item_type: "lesson_slice",
          },
          source: { source_section_id: "64010101" },
          atlas: { primary_outline_code: "64010101" },
          content: {
            prompt: "Name the apprehension gate.",
            front_blocks: [{ type: "rule", markdown: "Assault turns on apprehension." }],
          },
          task: { options: [{ id: "B", label: "Apprehension of imminent contact" }] },
        },
      ],
    });

    assert.equal(manifest.plan_key, "leadme-v5-assault-live-test");
    assert.equal(manifest.main_items.length, 1);
    assert.equal(manifest.main_items[0]?.title, "Assault Router");
    assert.deepEqual(
      manifest.steps.map((step) => step.content_ref.id),
      ["LMI-TORTS-64010101-ASSAULT-001", "LMI-TORTS-64010101-ASSAULT-002"],
    );
    assert.equal(manifest.steps[0]?.content_ref.type, "leadme_v5_candidate");
    assert.equal(manifest.steps[0]?.leadme_v5_item?.front_blocks[0]?.markdown, "Assault turns on apprehension.");
    assert.equal(manifest.steps[1]?.kind, "trap_repair");
    assert.equal(manifest.steps[1]?.leadme_v5_item?.options[0]?.label, "Actual ability only");
  });

  it("scores a selected response and returns branch feedback", () => {
    const result = evaluateLeadMeV5Response(
      {
        identity: {
          item_id: "LM-TORTS-ASSAULT-001",
          title: "Assault Is Apprehension",
          item_type: "micro_task",
        },
        atlas: { primary_outline_code: "64010101" },
        content: { prompt: "Pick the first assault question." },
        task: {
          options: [
            { id: "A", label: "Touching" },
            { id: "B", label: "Apprehension" },
          ],
        },
        evaluation: {
          correct: ["B"],
          responses: {
            A: { branch_id: "BR-WRONG", correctness: "incorrect", student_label: "Touching" },
            B: { branch_id: "BR-CORRECT", correctness: "correct", student_label: "Apprehension" },
          },
        },
        branches: {
          "BR-CORRECT": {
            display_blocks: [{ type: "feedback", markdown: "Correct. Assault is apprehension." }],
          },
        },
      },
      "B",
    );

    assert.equal(result.correct, true);
    assert.equal(result.selected_label, "Apprehension");
    assert.deepEqual(result.correct_responses, [{ id: "B", label: "Apprehension" }]);
    assert.equal(result.feedback_blocks[0]?.markdown, "Correct. Assault is apprehension.");
  });
});

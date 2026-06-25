import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryResult } from "../db.js";
import {
  LEADME_V5_ASSAULT_SET_ID,
  LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
  buildLeadMeV5CandidateManifest,
  evaluateLeadMeV5Response,
  readLeadMeV5CandidateManifest,
  readLeadMeV5CandidateSummaryForOutline,
  shouldRecordLeadMeV5DailyCompletion,
} from "./leadme-v5-day-plan.js";

function queryResult<T>(rows: unknown[]): QueryResult<T> {
  return { rows: rows as T[], rowCount: rows.length };
}

describe("buildLeadMeV5CandidateManifest", () => {
  it("maps V5 candidate set composition into the single live Lead Me module", () => {
    const manifest = buildLeadMeV5CandidateManifest({
      set: {
        identity: { set_id: LEADME_V5_ASSAULT_SET_ID, title: "Assault Router" },
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
    assert.equal(manifest.steps[0]?.leadme_v5_item?.coverage_role, null);
    assert.equal(manifest.steps[1]?.kind, "trap_repair");
    assert.equal(manifest.steps[1]?.leadme_v5_item?.options[0]?.label, "Actual ability only");
  });

  it("uses the Evidence non-hearsay module as the only active V5 path", async () => {
    const queries: string[] = [];
    const db = {
      async query<T>(_sql: string, params: readonly unknown[] = []): Promise<QueryResult<T>> {
        queries.push(String(params[0]));
        if (params[0] === LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID) {
          return queryResult([{
              set_id: LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
              candidate_json: {
                identity: {
                  set_id: LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
                  title: "Statements Used for Non-Hearsay Purposes",
                  set_type: "lesson_flow",
                },
                atlas_target: { primary_outline_code: "33040203", subject: "EVIDENCE" },
                delivery: { estimated_minutes: 5 },
                composition: {
                  sequence: [{
                    step_id: "first",
                    item_id: "LM-EVIDENCE-33040203-001",
                    role: "instruction",
                    required: true,
                    order_index: 1,
                  }],
                },
              },
            }]);
        }
        if (Array.isArray(params) && params[0] === "LM-EVIDENCE-33040203-001") {
          return queryResult([{
              item_id: "LM-EVIDENCE-33040203-001",
              candidate_json: {
                identity: {
                  item_id: "LM-EVIDENCE-33040203-001",
                  title: "Non-Hearsay Purpose Teach First",
                  item_type: "instruction",
                },
                source: { source_section_id: "33040203-001" },
                atlas: { primary_outline_code: "33040203", coverage_role: "memory_line" },
                content: {
                  prompt: "Read this first. The next cards check whether you picked it up.",
                  front_blocks: [{ type: "text", markdown: "Start with purpose, not truth." }],
                },
                task: {
                  task_type: "acknowledge",
                  micro_task_kind: "lead_me",
                  layout: "standard",
                  options: [],
                },
              },
            }]);
        }
        return queryResult([]);
      },
    };

    const manifest = await readLeadMeV5CandidateManifest(db);

    assert.deepEqual(queries.slice(0, 2), [
      LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
      "LM-EVIDENCE-33040203-001",
    ]);
    assert.equal(manifest?.plan_key, "leadme-v5-evidence-33040203-non-hearsay-purposes-full");
    assert.equal(manifest?.main_items[0]?.main_item_id, "leadme-v5-evidence-33040203");
    assert.equal(manifest?.steps[0]?.leadme_v5_item?.item_type, "instruction");
    assert.equal(manifest?.steps[0]?.leadme_v5_item?.task_type, "acknowledge");
    assert.equal(manifest?.steps[0]?.leadme_v5_item?.micro_task_kind, "lead_me");
    assert.equal(manifest?.steps[0]?.leadme_v5_item?.coverage_role, "memory_line");
    assert.deepEqual(manifest?.steps[0]?.leadme_v5_item?.options, []);
  });

  it("summarizes a V5 candidate set for an Atlas outline-code start", async () => {
    const db = {
      async query<T>(sql: string, params: readonly unknown[] = []): Promise<QueryResult<T>> {
        assert.match(sql, /FROM leadme_v5_set_candidates/);
        assert.equal(params[0], "33040203");
        return queryResult([{
          set_id: LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
          candidate_json: {
            identity: {
              set_id: LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
              title: "Statements Used for Non-Hearsay Purposes",
              set_type: "lesson_flow",
              status: "candidate",
            },
            atlas_target: { primary_outline_code: "33040203", subject: "EVIDENCE" },
            composition: {
              sequence: [
                { step_id: "s1", item_id: "LM-EVIDENCE-33040203-001", role: "instruction", required: true, order_index: 1 },
                { step_id: "s2", item_id: "LM-EVIDENCE-33040203-002", role: "micro_task", required: true, order_index: 2 },
              ],
            },
          },
        }]);
      },
    };

    const summary = await readLeadMeV5CandidateSummaryForOutline(db, "33040203");

    assert.deepEqual(summary, {
      set_id: LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
      title: "Statements Used for Non-Hearsay Purposes",
      set_type: "lesson_flow",
      status: "candidate",
      total_items: 2,
      inserted_items: 2,
    });
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
    assert.equal(result.item_type, "micro_task");
    assert.equal(result.selected_label, "Apprehension");
    assert.deepEqual(result.correct_responses, [{ id: "B", label: "Apprehension" }]);
    assert.equal(result.feedback_blocks[0]?.markdown, "Correct. Assault is apprehension.");
  });

  it("records only correct V5 attempts as completed daily steps", () => {
    assert.equal(shouldRecordLeadMeV5DailyCompletion(null), true);
    assert.equal(shouldRecordLeadMeV5DailyCompletion({ correct: true }), true);
    assert.equal(shouldRecordLeadMeV5DailyCompletion({ correct: false }), false);
  });
});

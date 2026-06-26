import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryResult } from "../db.js";
import {
  LEADME_V5_ASSAULT_SET_ID,
  LEADME_V5_EVIDENCE_NON_HEARSAY_SET_ID,
  buildLeadMeV5CandidateManifest,
  evaluateLeadMeV5Response,
  recordLeadMeV5ChoiceEvent,
  readLeadMeV5CandidateManifest,
  readLeadMeV5CandidateSummaryForOutline,
  shouldRecordLeadMeV5DailyCompletion,
} from "./leadme-v5-day-plan.js";

function queryResult<T>(rows: unknown[]): QueryResult<T> {
  return { rows: rows as T[], rowCount: rows.length };
}

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
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

  it("loads a selected V5 candidate module by Atlas outline code", async () => {
    const queries: unknown[][] = [];
    const db = {
      async query<T>(_sql: string, params: readonly unknown[] = []): Promise<QueryResult<T>> {
        queries.push([...params]);
        if (params[0] === "35030203") {
          return queryResult([{ set_id: "LMS-EVIDENCE-35030203-PHYSICIAN-PATIENT-FULL", candidate_json: {} }]);
        }
        if (params[0] === "LMS-EVIDENCE-35030203-PHYSICIAN-PATIENT-FULL") {
          return queryResult([{
            set_id: "LMS-EVIDENCE-35030203-PHYSICIAN-PATIENT-FULL",
            candidate_json: {
              identity: {
                set_id: "LMS-EVIDENCE-35030203-PHYSICIAN-PATIENT-FULL",
                title: "Physician Patient Privilege",
                set_type: "lesson_flow",
              },
              atlas_target: { primary_outline_code: "35030203", subject: "EVIDENCE" },
              delivery: { estimated_minutes: 5 },
              composition: {
                sequence: [{
                  step_id: "first",
                  item_id: "LM-EVIDENCE-35030203-001",
                  role: "instruction",
                  required: true,
                  order_index: 1,
                }],
              },
            },
          }]);
        }
        if (Array.isArray(params) && params[0] === "LM-EVIDENCE-35030203-001") {
          return queryResult([{
            item_id: "LM-EVIDENCE-35030203-001",
            candidate_json: {
              identity: {
                item_id: "LM-EVIDENCE-35030203-001",
                title: "Physician Patient Teach First",
                item_type: "instruction",
              },
              source: { source_section_id: "35030203-001" },
              atlas: { primary_outline_code: "35030203", coverage_role: "memory_line" },
              content: {
                prompt: "Read this first. The next cards check whether you picked it up.",
                front_blocks: [{ type: "text", markdown: "Privilege depends on the jurisdiction's rule." }],
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

    const manifest = await readLeadMeV5CandidateManifest(db, "35030203");

    assert.deepEqual(queries.map((params) => params[0]), [
      "35030203",
      "LMS-EVIDENCE-35030203-PHYSICIAN-PATIENT-FULL",
      "LM-EVIDENCE-35030203-001",
    ]);
    assert.equal(manifest?.plan_key, "leadme-v5-evidence-35030203-physician-patient-full");
    assert.equal(manifest?.main_items[0]?.description, "LeadMe V5 module for EVIDENCE: Physician Patient Privilege.");
    assert.equal(manifest?.steps[0]?.content_ref.id, "LM-EVIDENCE-35030203-001");
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

  it("does not expose V5 answer keys or branch payloads in candidate manifests", () => {
    const manifest = buildLeadMeV5CandidateManifest({
      set: {
        identity: { set_id: LEADME_V5_ASSAULT_SET_ID, title: "Assault Router" },
        atlas_target: { primary_outline_code: "64010101", subject: "Torts" },
        composition: {
          sequence: [{
            step_id: "first",
            item_id: "LMI-TORTS-64010101-ASSAULT-001",
            role: "gate",
            required: true,
            order_index: 1,
          }],
        },
      },
      items: [{
        identity: {
          item_id: "LMI-TORTS-64010101-ASSAULT-001",
          title: "Apprehension gate",
          item_type: "multiple_choice",
        },
        atlas: { primary_outline_code: "64010101" },
        content: {
          prompt: "Pick the first assault question.",
          front_blocks: [{ type: "text", markdown: "Assault is apprehension." }],
        },
        task: {
          options: [
            { id: "A", label: "Touching" },
            { id: "B", label: "Apprehension" },
          ],
        },
        evaluation: {
          correct: ["B"],
          responses: {
            A: { branch_id: "BR-SECRET-WRONG", correctness: "incorrect" },
            B: { branch_id: "BR-SECRET-CORRECT", correctness: "correct" },
          },
        },
        branches: {
          "BR-SECRET-CORRECT": {
            display_blocks: [{ type: "feedback", markdown: "SECRET_FEEDBACK" }],
          },
        },
      }],
    });

    const body = JSON.stringify(manifest);

    assert.doesNotMatch(body, /"evaluation"/);
    assert.doesNotMatch(body, /"branches"/);
    assert.doesNotMatch(body, /"correct"/);
    assert.doesNotMatch(body, /BR-SECRET/);
    assert.doesNotMatch(body, /SECRET_FEEDBACK/);
  });

  it("records Assault and Evidence V5 choice submissions as useful attempt events", async () => {
    const calls: RecordedQuery[] = [];
    const db = {
      async query<T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> {
        calls.push({ sql, values });
        return queryResult([]);
      },
    };
    const assaultResult = evaluateLeadMeV5Response(
      {
        identity: {
          item_id: "LMI-TORTS-64010101-ASSAULT-001",
          title: "Assault Is Apprehension",
          item_type: "multiple_choice",
        },
        atlas: { primary_outline_code: "64010101" },
        content: { prompt: "Pick the first assault question." },
        task: {
          task_type: "multiple_choice",
          micro_task_kind: "lead_me",
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
    const evidenceResult = evaluateLeadMeV5Response(
      {
        identity: {
          item_id: "LM-EVIDENCE-35030203-002",
          title: "Physician-patient Source Law Gate",
          item_type: "multiple_choice",
        },
        atlas: { primary_outline_code: "35030203" },
        content: { prompt: "Pick the source-law move." },
        task: {
          task_type: "multiple_choice",
          micro_task_kind: "lead_me",
          options: [
            { id: "A", label: "Federal always recognizes it" },
            { id: "B", label: "Check the governing source law" },
          ],
        },
        evaluation: {
          correct: ["B"],
          responses: {
            A: { branch_id: "BR-WRONG", correctness: "incorrect" },
            B: { branch_id: "BR-CORRECT", correctness: "correct" },
          },
        },
        branches: {
          "BR-WRONG": {
            display_blocks: [{ type: "feedback", markdown: "Do not assume a general federal physician-patient privilege." }],
          },
        },
      },
      "A",
    );

    await recordLeadMeV5ChoiceEvent(db, {
      eventId: "evt_assault",
      studentId: "stu_1",
      dayKey: "2026-06-25",
      planKey: "leadme-v5-assault-live-test",
      stepId: "leadme-v5-lmi-torts-64010101-assault-001",
      mainItemId: "leadme-v5-assault",
      outlineCode: "64010101",
      timeSpentSec: 12,
      result: assaultResult,
    });
    await recordLeadMeV5ChoiceEvent(db, {
      eventId: "evt_evidence",
      studentId: "stu_1",
      dayKey: "2026-06-25",
      planKey: "leadme-v5-evidence-35030203-physician-patient-full",
      stepId: "leadme-v5-lm-evidence-35030203-002",
      mainItemId: "leadme-v5-evidence-35030203-physician-patient-full",
      outlineCode: "35030203",
      timeSpentSec: null,
      result: evidenceResult,
    });

    assert.equal(calls.length, 2);
    assert.match(calls[0]?.sql ?? "", /INSERT INTO student_leadme_events/);
    assert.deepEqual(calls[0]?.values.slice(0, 9), [
      "evt_assault",
      "stu_1",
      "leadme-v5-lmi-torts-64010101-assault-001",
      "LMI-TORTS-64010101-ASSAULT-001",
      "leadme_v5_choice_submit",
      "B",
      "correct",
      12,
      calls[0]?.values[8],
    ]);
    const assaultPayload = JSON.parse(String(calls[0]?.values[8])) as Record<string, unknown>;
    assert.equal(assaultPayload.selected_response, "B");
    assert.equal(assaultPayload.correctness, "correct");
    assert.match(JSON.stringify(assaultPayload), /Correct\. Assault is apprehension\./);

    assert.equal(calls[1]?.values[5], "A");
    assert.equal(calls[1]?.values[6], "incorrect");
    const evidencePayload = JSON.parse(String(calls[1]?.values[8])) as Record<string, unknown>;
    assert.equal(evidencePayload.outline_code, "35030203");
    assert.equal(evidencePayload.selected_response, "A");
    assert.equal(evidencePayload.correctness, "incorrect");
    assert.match(JSON.stringify(evidencePayload), /general federal physician-patient privilege/);
  });

  it("records only correct V5 attempts as completed daily steps", () => {
    assert.equal(shouldRecordLeadMeV5DailyCompletion(null), true);
    assert.equal(shouldRecordLeadMeV5DailyCompletion({ correct: true }), true);
    assert.equal(shouldRecordLeadMeV5DailyCompletion({ correct: false }), false);
  });
});

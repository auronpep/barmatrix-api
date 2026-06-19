import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import {
  readDebriefIntelElementById,
  readDebriefIntelElements,
  readLeadMeDebriefIntelligence,
} from "./leadme-debrief-service.js";

type Queryable = Pick<DbPool, "query">;

function dbFor(): Queryable {
  return {
    query: async <T>(): Promise<QueryResult<T>> =>
      ({
        rows: [
          {
            element_id: "DEI-1",
            element_type: "clash_axis",
            title: "Lie plus reliance vs intent",
            status: "active",
            subject: "CRIMINAL",
            primary_outline_code: "73030300",
            method_phase: "CLASH",
            method_class: "anchor_assisted",
            governing_law_type: "RULE",
            source_count: 3,
            review_status: "legal_reviewed",
            yaml_json_text: JSON.stringify({
              identity: {
                element_id: "DEI-1",
                element_type: "clash_axis",
                title: "Lie plus reliance vs intent",
              },
              content: {
                student_signal: "Two answers fight over whether belief defeats fraud.",
                axis: "intent to defraud",
                splitting_fact: "The defendant believed the property was hers.",
                review_truth: "False pretenses requires intent to defraud.",
                student_script: "Do not stop at lie plus reliance.",
              },
              choice_links: {
                credited_choice: "A",
                dominant_trap_choice: "B",
                survivor_pair: ["A", "B"],
              },
              leadme_exports: {
                default_detour_item_id: "LM-REPAIR-1",
              },
              qa: {
                legal_review_required: true,
              },
              source: {
                primary_qid: "14721",
              },
            }),
          },
          {
            element_id: "DEI-PENDING",
            element_type: "gold_key",
            title: "Unreviewed",
            status: "candidate",
            subject: "CRIMINAL",
            primary_outline_code: "73030300",
            method_phase: "RULE",
            method_class: "anchor_assisted",
            governing_law_type: "RULE",
            source_count: 1,
            review_status: "pending",
            yaml_json_text: JSON.stringify({
              identity: { element_id: "DEI-PENDING", element_type: "gold_key", title: "Unreviewed" },
              content: { student_script: "Do not show yet." },
            }),
          },
        ],
        rowCount: 2,
      }) as QueryResult<T>,
  };
}

describe("readLeadMeDebriefIntelligence", () => {
  it("returns only reviewed student-safe debrief elements for the selected trap", async () => {
    const debrief = await readLeadMeDebriefIntelligence(dbFor(), {
      subject: "CRIMINAL",
      primaryOutlineCode: "73030300",
      selectedResponse: "B",
      correctResponse: "A",
    });

    assert.deepEqual(debrief.auto_expand_sections, ["solve.clash", "molds.choice_B"]);
    assert.deepEqual(debrief.auto_expand_choices, ["B", "A"]);
    assert.deepEqual(debrief.elements, [
      {
        element_id: "DEI-1",
        element_type: "clash_axis",
        title: "Lie plus reliance vs intent",
        method_phase: "CLASH",
        student_signal: "Two answers fight over whether belief defeats fraud.",
        axis: "intent to defraud",
        splitting_fact: "The defendant believed the property was hers.",
        review_truth: "False pretenses requires intent to defraud.",
        student_script: "Do not stop at lie plus reliance.",
        default_detour_item_id: "LM-REPAIR-1",
      },
    ]);
    assert.equal("qa" in (debrief.elements[0] ?? {}), false);
    assert.equal("source" in (debrief.elements[0] ?? {}), false);
  });

  it("lists only reviewed student-safe debrief intel elements", async () => {
    const elements = await readDebriefIntelElements(dbFor(), {
      type: "clash_axis",
      outlineCode: "73030300",
      limit: 10,
    });

    assert.deepEqual(elements, [
      {
        element_id: "DEI-1",
        element_type: "clash_axis",
        title: "Lie plus reliance vs intent",
        subject: "CRIMINAL",
        primary_outline_code: "73030300",
        method_phase: "CLASH",
        method_class: "anchor_assisted",
        governing_law_type: "RULE",
        source_count: 3,
        student_signal: "Two answers fight over whether belief defeats fraud.",
        axis: "intent to defraud",
        splitting_fact: "The defendant believed the property was hers.",
        review_truth: "False pretenses requires intent to defraud.",
        student_script: "Do not stop at lie plus reliance.",
        default_detour_item_id: "LM-REPAIR-1",
      },
    ]);
    assert.equal("qa" in (elements[0] ?? {}), false);
    assert.equal("source" in (elements[0] ?? {}), false);
  });

  it("reads a reviewed debrief intel element by id", async () => {
    const element = await readDebriefIntelElementById(dbFor(), "DEI-1");

    assert.equal(element?.element_id, "DEI-1");
    assert.equal(element?.source_count, 3);
    assert.equal(element?.student_script, "Do not stop at lie plus reliance.");
  });
});

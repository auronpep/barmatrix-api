import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbPool, QueryResult } from "../db.js";
import {
  readStudentDebrief,
  recordStudentDebriefEvent,
} from "./student-debrief.js";

type Queryable = Pick<DbPool, "query">;

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

function dbFor(
  handler: (query: RecordedQuery) => QueryResult<unknown>,
  calls: RecordedQuery[] = [],
): Queryable {
  return {
    query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
      const query = { sql, values };
      calls.push(query);
      return handler(query) as QueryResult<T>;
    },
  };
}

function debriefRow(): QueryResult<unknown> {
  return {
    rows: [
      {
        debrief_id: "DEBRIEF-Q1",
        qid: "Q1",
        subject: "Evidence",
        primary_outline_code: "31010100",
        correct_letter: "C",
        dominant_trap_letter: "B",
        status: "active",
        version: "1.0.0",
        content_hash: "sha256:debrief",
      },
    ],
    rowCount: 1,
  };
}

describe("student debrief", () => {
  it("reads a debrief with a student-owned attempt overlay", async () => {
    const db = dbFor((query) => {
      if (query.sql.includes("FROM debriefs")) return debriefRow();
      if (query.sql.includes("FROM debrief_sections")) {
        return {
          rows: [
            {
              section_id: "sec_1",
              section_key: "solve.clash",
              section_type: "clash",
              title: "Solve the clash",
              order_index: "1",
              compiled_json_text: JSON.stringify({ markdown: "Student-safe section." }),
            },
          ],
          rowCount: 1,
        };
      }
      if (query.sql.includes("FROM student_attempts")) {
        return {
          rows: [
            {
              selected_letter: "B",
              correct: 0,
              metadata: JSON.stringify({ branch_id: "BR-B-TRAP" }),
            },
          ],
          rowCount: 1,
        };
      }
      if (query.sql.includes("FROM debrief_elements")) {
        return {
          rows: [
            {
              element_id: "DEI-1",
              element_type: "clash_axis",
              title: "Belief versus intent",
              status: "active",
              subject: "Evidence",
              primary_outline_code: "31010100",
              method_phase: "clash",
              method_class: "two_answer_trap",
              governing_law_type: "mbe",
              source_count: "4",
              review_status: "legal_reviewed",
              yaml_json_text: JSON.stringify({
                identity: {
                  element_id: "DEI-1",
                  element_type: "clash_axis",
                  title: "Belief versus intent",
                },
                content: {
                  student_signal: "You saw the fact but gave it the wrong legal job.",
                  axis: "belief versus intent",
                },
                choice_links: {
                  dominant_trap_choice: "B",
                  credited_choice: "C",
                },
                leadme_exports: {
                  default_detour_item_id: "LM-DETOUR-1",
                },
              }),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const result = await readStudentDebrief(db, {
      studentId: "stu_1",
      qid: "Q1",
      attemptEventId: "att_1",
    });

    assert.equal(result?.debrief.debrief_id, "DEBRIEF-Q1");
    assert.deepEqual(result?.debrief.sections[0]?.payload, {
      markdown: "Student-safe section.",
    });
    assert.equal(result?.student_overlay?.selected_letter, "B");
    assert.equal(result?.student_overlay?.student_path_label, "BR-B-TRAP");
    assert.deepEqual(result?.student_overlay?.auto_expand_choices, ["B", "C"]);
    assert.deepEqual(result?.student_overlay?.recommended_detours, ["LM-DETOUR-1"]);
    assert.equal(result?.student_overlay?.elements[0]?.element_id, "DEI-1");
  });

  it("records debrief events and updates element exposure projections", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor((query) => {
      if (query.sql.includes("FROM debriefs")) return debriefRow();
      if (query.sql.includes("FROM student_attempts")) {
        return { rows: [{ attempt_id: "att_1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }, calls);

    const recorded = await recordStudentDebriefEvent(db, {
      eventId: "evt_1",
      studentId: "stu_1",
      qid: "Q1",
      attemptEventId: "att_1",
      eventType: "element_viewed",
      sectionKey: "solve.clash",
      elementId: "DEI-1",
      dwellMs: 1250,
      payload: { source: "answer_key" },
    });

    assert.deepEqual(recorded, {
      event_id: "evt_1",
      debrief_id: "DEBRIEF-Q1",
    });
    assert.match(calls[2]?.sql ?? "", /INSERT INTO student_debrief_events/);
    assert.deepEqual(calls[2]?.values, [
      "evt_1",
      "stu_1",
      "Q1",
      "att_1",
      "DEBRIEF-Q1",
      "solve.clash",
      "DEI-1",
      "element_viewed",
      1250,
      JSON.stringify({ source: "answer_key" }),
    ]);
    assert.match(calls[3]?.sql ?? "", /INSERT INTO student_debrief_element_state/);
    assert.deepEqual(calls[3]?.values, ["stu_1", "DEI-1", 1]);
    assert.match(calls[4]?.sql ?? "", /INSERT INTO debrief_element_stats/);
    assert.deepEqual(calls[4]?.values, ["DEI-1", 1, 0, 0]);
  });

  it("does not record a debrief event against an attempt the student does not own", async () => {
    const calls: RecordedQuery[] = [];
    const db = dbFor((query) => {
      if (query.sql.includes("FROM debriefs")) return debriefRow();
      return { rows: [], rowCount: 0 };
    }, calls);

    const recorded = await recordStudentDebriefEvent(db, {
      eventId: "evt_2",
      studentId: "stu_1",
      qid: "Q1",
      attemptEventId: "other_student_attempt",
      eventType: "section_opened",
    });

    assert.equal(recorded, null);
    assert.equal(
      calls.some((call) => call.sql.includes("INSERT INTO student_debrief_events")),
      false,
    );
  });
});

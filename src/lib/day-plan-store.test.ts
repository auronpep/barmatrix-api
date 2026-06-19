import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryResult } from "../db.js";
import { DAY1_PLAN } from "./day-plan.js";
import {
  ensureDayPlanTables,
  recordCatchupStepCompletion,
  recordDailyStepCompletion,
} from "./day-plan-store.js";

type Call = { sql: string; values: readonly unknown[] };

function mockDb() {
  const calls: Call[] = [];
  return {
    calls,
    db: {
      query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
        calls.push({ sql, values });
        return {
          rows: [],
          rowCount: sql.includes("INSERT IGNORE") ||
            sql.includes("UPDATE student_catchup_bank") ? 1 : 0,
        };
      },
    },
  };
}

describe("day plan storage", () => {
  it("creates progress and catchup-bank tables", async () => {
    const { calls, db } = mockDb();

    await ensureDayPlanTables(db);

    assert.match(calls[0]?.sql ?? "", /CREATE TABLE IF NOT EXISTS student_day_plan_progress/);
    assert.match(calls[1]?.sql ?? "", /CREATE TABLE IF NOT EXISTS student_catchup_bank/);
  });

  it("records a daily step completion with explicit content metadata", async () => {
    const { calls, db } = mockDb();
    const step = DAY1_PLAN.steps[0]!;

    await recordDailyStepCompletion(db, {
      studentId: "student-1",
      dayKey: "2026-06-08",
      step,
    });

    const insert = calls.find((call) => call.sql.includes("INSERT IGNORE INTO student_day_plan_progress"));
    assert.ok(insert);
    assert.equal(insert.values[1], "student-1");
    assert.equal(insert.values[2], "2026-06-08");
    assert.equal(insert.values[3], step.step_id);
    assert.equal(insert.values[4], "daily");
    assert.equal(insert.values[6], step.content_ref.type);
    assert.equal(insert.values[7], step.content_ref.id);
  });

  it("marks a catchup task complete and records the catchup progress event", async () => {
    const { calls, db } = mockDb();

    await recordCatchupStepCompletion(db, {
      studentId: "student-1",
      dayKey: "2026-06-08",
      catchupId: "catchup-1",
    });

    assert.ok(calls.some((call) => call.sql.includes("UPDATE student_catchup_bank")));
    const insert = calls.find((call) => call.sql.includes("INSERT IGNORE INTO student_day_plan_progress"));
    assert.ok(insert);
    assert.equal(insert.values[1], "student-1");
    assert.equal(insert.values[2], "2026-06-08");
    assert.equal(insert.values[3], "catchup-1");
    assert.equal(insert.values[4], "catchup");
  });

  it("does not grant catchup progress when no pending catchup row was updated", async () => {
    const calls: Call[] = [];
    const db = {
      query: async <T>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> => {
        calls.push({ sql, values });
        return { rows: [], rowCount: 0 };
      },
    };

    const recorded = await recordCatchupStepCompletion(db, {
      studentId: "student-1",
      dayKey: "2026-06-08",
      catchupId: "catchup-1",
    });

    assert.equal(recorded, false);
    assert.equal(
      calls.some((call) => call.sql.includes("INSERT IGNORE INTO student_day_plan_progress")),
      false,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DbClient, DbPool, QueryResult } from "../db.js";
import {
  assignSeatWithinCapacity,
  CohortCapacityFullError,
  CohortCapacityUnavailableError,
  enforceCheckoutCapacityOpen,
} from "./capacity.js";

function rows<T>(items: T[]): QueryResult<T> {
  return { rows: items, rowCount: items.length };
}

function fakePool(
  handler: (sql: string, values?: readonly unknown[]) => Promise<QueryResult<unknown>>,
): Pick<DbPool, "query"> {
  return {
    query: handler as DbPool["query"],
  };
}

function fakeClient(
  handler: (sql: string, values?: readonly unknown[]) => Promise<QueryResult<unknown>>,
): DbClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    query: (async (sql: string, values?: readonly unknown[]) => {
      calls.push(sql);
      return handler(sql, values);
    }) as DbClient["query"],
    release: () => {},
  };
}

describe("checkout capacity enforcement", () => {
  it("fails closed when the capacity lookup cannot reach the database", async () => {
    const pool = fakePool(async () => {
      throw new Error("database unavailable");
    });

    await assert.rejects(
      () => enforceCheckoutCapacityOpen(pool, "JULY_MBE_REPAIR"),
      CohortCapacityUnavailableError,
    );
  });

  it("rejects checkout creation when the cohort is already full", async () => {
    const pool = fakePool(async () =>
      rows([
        {
          cohort_id: "cohort_1",
          internal_capacity: 1,
          active_count: "1",
        },
      ]),
    );

    await assert.rejects(
      () => enforceCheckoutCapacityOpen(pool, "JULY_MBE_REPAIR"),
      CohortCapacityFullError,
    );
  });
});

describe("fulfillment seat assignment", () => {
  it("locks the cohort row and refuses to insert a new seat at internal capacity", async () => {
    let attemptedInsert = false;
    const client = fakeClient(async (sql) => {
      if (sql.includes("FROM cohort_config") && sql.includes("FOR UPDATE")) {
        return rows([{ internal_capacity: 1 }]);
      }
      if (sql.includes("FROM cohort_enrollments") && sql.includes("student_id")) {
        return rows([]);
      }
      if (sql.includes("COUNT") && sql.includes("cohort_enrollments")) {
        return rows([{ active_count: "1" }]);
      }
      if (sql.includes("INSERT INTO cohort_enrollments")) {
        attemptedInsert = true;
      }
      return rows([]);
    });

    await assert.rejects(
      () => assignSeatWithinCapacity(client, "cohort_1", "student_2"),
      CohortCapacityFullError,
    );

    assert.equal(attemptedInsert, false);
    assert.match(client.calls[0] ?? "", /FOR UPDATE/);
  });
});

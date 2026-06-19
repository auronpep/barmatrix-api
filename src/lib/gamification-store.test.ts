import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbClient, DbPool, QueryResult } from "../db.js";
import { grantBootCampActivity } from "./gamification-store.js";

describe("grantBootCampActivity", () => {
  it("locks the gamification row before advancing streak state", async () => {
    const calls: string[] = [];
    const client: DbClient = {
      query: async <T>(sql: string): Promise<QueryResult<T>> => {
        calls.push(sql);
        if (sql.includes("SELECT current_streak")) {
          return {
            rows: [
              {
                current_streak: 2,
                longest_streak: 2,
                last_active_date: "2026-06-18",
              } as T,
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT badge_slug")) return { rows: [], rowCount: 0 };
        if (sql.includes("SELECT COALESCE(SUM(xp)")) {
          return { rows: [{ total: 15 } as T], rowCount: 1 };
        }
        return {
          rows: [],
          rowCount: sql.includes("INSERT IGNORE INTO student_xp_events") ? 1 : 0,
        };
      },
      release: () => undefined,
    };
    const pool = {
      connect: async () => client,
    } as Pick<DbPool, "connect"> as DbPool;

    await grantBootCampActivity(pool, {
      studentId: "stu_1",
      sourceType: "boot_camp_day",
      sourceRef: "day-1",
      xp: 5,
      contentBadges: [],
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    assert.match(
      calls.find((sql) => sql.includes("SELECT current_streak")) ?? "",
      /FOR UPDATE/,
    );
  });
});

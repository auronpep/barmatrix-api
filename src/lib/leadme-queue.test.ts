import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chooseLeadMeQueueEntry,
  type LeadMeQueueEntry,
} from "./leadme-queue.js";

const NOW = new Date("2026-06-18T12:00:00Z");

function entry(
  queue_entry_id: string,
  rail_scope: LeadMeQueueEntry["rail_scope"],
  over: Partial<LeadMeQueueEntry> = {},
): LeadMeQueueEntry {
  return {
    queue_entry_id,
    student_id: "stu_1",
    item_id: `LM-${queue_entry_id}`,
    item_version: "1.0.0",
    content_hash: `sha256:${queue_entry_id}`,
    status: "available",
    rail_scope,
    day_number: 2,
    origin_day_number: 2,
    priority: 0,
    mandatory: false,
    dependency_free: true,
    available_at: new Date("2026-06-18T00:00:00Z"),
    injection_depth: 0,
    ...over,
  };
}

describe("chooseLeadMeQueueEntry", () => {
  it("keeps the current served entry until it stalls", () => {
    const served = entry("served", "current_day", {
      status: "served",
      served_at: new Date(NOW.getTime() - 5 * 60 * 1000),
    });
    const immediate = entry("repair", "in_set_immediate", { mandatory: true });

    const out = chooseLeadMeQueueEntry([immediate, served], { now: NOW, currentDay: 2 });

    assert.equal(out.entry?.queue_entry_id, "served");
    assert.equal(out.reason, "current_served");
  });

  it("rotates a stalled served entry to a dependency-free current-day replacement", () => {
    const stalled = entry("stalled", "current_day", {
      status: "viewed",
      viewed_at: new Date(NOW.getTime() - 16 * 60 * 1000),
    });
    const blocked = entry("blocked", "current_day", { dependency_free: false, priority: 10 });
    const replacement = entry("replacement", "current_day", { priority: 1 });

    const out = chooseLeadMeQueueEntry([stalled, blocked, replacement], {
      now: NOW,
      currentDay: 2,
    });

    assert.equal(out.entry?.queue_entry_id, "replacement");
    assert.equal(out.reason, "stall_rotation");
    assert.equal(out.stalled_entry_id, "stalled");
  });

  it("serves one immediate repair before the next current-day item", () => {
    const repair = entry("repair", "in_set_immediate", {
      mandatory: true,
      injection_depth: 1,
    });
    const today = entry("today", "current_day", { priority: 10 });

    const out = chooseLeadMeQueueEntry([today, repair], { now: NOW, currentDay: 2 });

    assert.equal(out.entry?.queue_entry_id, "repair");
    assert.equal(out.reason, "in_set_immediate");
  });

  it("does not serve catchup until current-day progress permits it", () => {
    const catchup = entry("catchup", "catchup", { day_number: 1, origin_day_number: 1 });

    const blocked = chooseLeadMeQueueEntry([catchup], {
      now: NOW,
      currentDay: 2,
      allowCatchup: false,
    });
    const allowed = chooseLeadMeQueueEntry([catchup], {
      now: NOW,
      currentDay: 2,
      allowCatchup: true,
    });

    assert.equal(blocked.entry, null);
    assert.equal(allowed.entry?.queue_entry_id, "catchup");
    assert.equal(allowed.reason, "catchup");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildC3RedZoneTaxonomy,
  LOCKED_RED_ZONE_CATEGORIES,
} from "./generate-c3-redzone-taxonomy.js";

const SOURCE_DIR = "C:/AAABM/finished";
const LOCKED_IDS = new Set(LOCKED_RED_ZONE_CATEGORIES.map((row) => row.red_zone_id));

describe("C3 Red-Zone V5 taxonomy import", () => {
  it("parses the packet corpus into locked Red-Zone V5 rows", () => {
    const data = buildC3RedZoneTaxonomy(SOURCE_DIR);

    assert.equal(data.totals.files, 562);
    assert.equal(data.totals.packets, 562);
    assert.equal(data.categories.length, 10);
    assert.equal(data.totals.axes, 1456);
    assert.equal(data.totals.choice_patterns, 3525);
    assert.equal(data.totals.human_review_rows, 2);
    assert.equal(new Set(data.packets.map((packet) => packet.outline_code)).size, 562);
    assert.equal(new Set(data.axes.map((axis) => axis.axis_id)).size, data.axes.length);
    assert.equal(
      new Set(data.choice_patterns.map((pattern) => pattern.choice_pattern_id)).size,
      data.choice_patterns.length,
    );
  });

  it("keeps visible rows on the locked red-zone vocabulary only", () => {
    const data = buildC3RedZoneTaxonomy(SOURCE_DIR);

    assert.ok(data.axes.filter((axis) => axis.visible).length > 0);
    assert.ok(data.choice_patterns.filter((pattern) => pattern.visible).length > 0);
    for (const axis of data.axes.filter((row) => row.visible)) {
      assert.ok(LOCKED_IDS.has(axis.red_zone_id), axis.red_zone_id);
      assert.ok(axis.axis_name);
      assert.ok(axis.method_class);
    }
    for (const pattern of data.choice_patterns.filter((row) => row.visible)) {
      assert.ok(LOCKED_IDS.has(pattern.red_zone_id), pattern.red_zone_id);
      assert.ok(pattern.filter_broken);
      assert.ok(pattern.mold_code);
    }
  });

  it("blocks the two human-review packets from student-visible rows", () => {
    const data = buildC3RedZoneTaxonomy(SOURCE_DIR);
    const blockedCodes = new Set(
      data.packets.filter((packet) => packet.human_review_count > 0).map((packet) => packet.outline_code),
    );

    assert.deepEqual([...blockedCodes].sort(), ["35030203", "35030206"]);
    assert.equal(data.axes.some((axis) => blockedCodes.has(axis.outline_code) && axis.visible), false);
    assert.equal(
      data.choice_patterns.some((pattern) => blockedCodes.has(pattern.outline_code) && pattern.visible),
      false,
    );
  });
});

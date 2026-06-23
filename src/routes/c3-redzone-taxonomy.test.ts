import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";

import {
  buildC3RedZoneCatalog,
  getC3OutlineComponents,
  listC3Axes,
  listC3ChoicePatterns,
  loadC3RedZoneTaxonomy,
} from "../lib/c3-redzone-taxonomy.js";
import { registerC3RedZoneTaxonomyRoutes } from "./c3-redzone-taxonomy.js";

let baseUrl = "";
let server: ReturnType<ReturnType<typeof express>["listen"]>;

describe("C3 Red-Zone V5 taxonomy routes", () => {
  before(async () => {
    const app = express();
    registerC3RedZoneTaxonomyRoutes(app);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("serves the locked red-zone catalog without legacy user_red_zones data", async () => {
    const response = await fetch(`${baseUrl}/api/red-zones/catalog`);
    const body = await response.json() as ReturnType<typeof buildC3RedZoneCatalog>;

    assert.equal(response.status, 200);
    assert.equal(body.categories.length, 10);
    assert.equal(body.totals.visible_packets, 560);
    assert.ok(body.categories.some((category) => category.axis_count > 0));
    assert.ok(body.categories.some((category) => category.red_zone_id === "RZ-10"));
  });

  it("filters C3 axes and choice patterns from the generated packet corpus", async () => {
    const axesResponse = await fetch(`${baseUrl}/api/c3/tensions?red_zone_id=RZ-01&limit=5`);
    const axesBody = await axesResponse.json() as ReturnType<typeof listC3Axes>;
    const trapsResponse = await fetch(`${baseUrl}/api/c3/traps?mold_code=misfit&limit=5`);
    const trapsBody = await trapsResponse.json() as ReturnType<typeof listC3ChoicePatterns>;

    assert.equal(axesResponse.status, 200);
    assert.equal(axesBody.axes.length, 5);
    assert.ok(axesBody.axes.every((axis) => axis.red_zone_id === "RZ-01"));
    assert.equal(trapsResponse.status, 200);
    assert.equal(trapsBody.choice_patterns.length, 5);
    assert.ok(trapsBody.choice_patterns.every((pattern) => pattern.mold_code === "misfit"));
  });

  it("keeps human-review outline packets out of student-visible components", () => {
    const data = loadC3RedZoneTaxonomy();

    assert.equal(getC3OutlineComponents("35030203", data), null);
    assert.ok(getC3OutlineComponents("31010100", data));
  });
});

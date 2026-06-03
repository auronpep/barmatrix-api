import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allBundles,
  bundleCount,
  bundlesByRouteFamily,
  c3PhaseCounts,
  getBundle,
  validateBundles,
} from "./diag-remediation.js";

describe("diag-remediation", () => {
  it("stages exactly 51 bundles", () => {
    assert.equal(bundleCount(), 51);
    assert.equal(allBundles().length, 51);
  });

  it("getBundle returns a real bundle for a known remediation_id", () => {
    const bundle = getBundle("R-CIVPRO-PJ-OVERCLAIM");
    assert.ok(bundle, "expected a bundle for R-CIVPRO-PJ-OVERCLAIM");
    assert.equal(bundle.bundle_id, "BUNDLE-R-CIVPRO-PJ-OVERCLAIM");
    assert.equal(bundle.c3_profile.c3_phase, "CUT");
    assert.ok(bundle.micro_sequence.length > 0);
    assert.ok(bundle.mastery_gate.length > 0);
  });

  it("getBundle returns null for an unknown remediation_id", () => {
    assert.equal(getBundle("R-DOES-NOT-EXIST"), null);
  });

  it("validateBundles passes structural checks", () => {
    const result = validateBundles();
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });

  it("c3PhaseCounts sums to 51 with expected rough distribution", () => {
    const counts = c3PhaseCounts();
    assert.equal(counts.CUT + counts.CLASH + counts.CALL, 51);
    assert.equal(counts.CUT, 23);
    assert.equal(counts.CLASH, 14);
    assert.equal(counts.CALL, 14);
  });

  it("bundlesByRouteFamily groups every bundle", () => {
    const byFamily = bundlesByRouteFamily();
    const total = [...byFamily.values()].reduce((sum, list) => sum + list.length, 0);
    assert.equal(total, 51);
    // every bundle in a group shares that group's route_family
    for (const [family, list] of byFamily) {
      for (const bundle of list) {
        assert.equal(bundle.c3_profile.route_family, family);
      }
    }
  });
});

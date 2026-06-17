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
  it("stages no remediation bundles while the learning bank is reset", () => {
    assert.equal(bundleCount(), 0);
    assert.equal(allBundles().length, 0);
  });

  it("getBundle returns null for an archived remediation_id", () => {
    const bundle = getBundle("R-CIVPRO-PJ-OVERCLAIM");
    assert.equal(bundle, null);
  });

  it("getBundle returns null for an unknown remediation_id", () => {
    assert.equal(getBundle("R-DOES-NOT-EXIST"), null);
  });

  it("validateBundles passes structural checks", () => {
    const result = validateBundles();
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });

  it("c3PhaseCounts reports zeroed phases", () => {
    const counts = c3PhaseCounts();
    assert.deepEqual(counts, { CUT: 0, CLASH: 0, CALL: 0 });
  });

  it("bundlesByRouteFamily is empty", () => {
    const byFamily = bundlesByRouteFamily();
    const total = [...byFamily.values()].reduce((sum, list) => sum + list.length, 0);
    assert.equal(total, 0);
    assert.equal(byFamily.size, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listSubjects, getOverlay, getCards, getDrills, getApplicationRows, getResidue, isSubjectCode,
} from "./c3-subjects.js";
import { validateCriminal, validateRealProperty, validateAllSubjects } from "./c3-subjects-validate.js";

describe("c3-subjects loader", () => {
  it("lists subject shells with empty content during reset", () => {
    const subjects = listSubjects();
    assert.equal(subjects.length, 2);
    const crim = subjects.find((s) => s.code === "CRIMINAL_LAW_PROCEDURE")!;
    assert.equal(crim.application_rows, 0);
    assert.equal(crim.cards, 0);
    assert.equal(crim.drills, 0);
    assert.equal(crim.student_mantra, "");
    const rp = subjects.find((s) => s.code === "REAL_PROPERTY")!;
    assert.equal(rp.lessons, 0);
    assert.equal(rp.cards, 0);
    assert.equal(rp.drills, 0);
    assert.equal(rp.student_mantra, "");
  });

  it("isSubjectCode guards", () => {
    assert.equal(isSubjectCode("CRIMINAL_LAW_PROCEDURE"), true);
    assert.equal(isSubjectCode("REAL_PROPERTY"), true);
    assert.equal(isSubjectCode("EVIDENCE"), false);
  });

  it("serves overlays and empty cards/drills/residue", () => {
    assert.ok(getOverlay("CRIMINAL_LAW_PROCEDURE"));
    assert.deepEqual(getCards("CRIMINAL_LAW_PROCEDURE"), []);
    assert.deepEqual(getDrills("REAL_PROPERTY"), []);
    assert.ok(getResidue("CRIMINAL_LAW_PROCEDURE"));
  });

  it("filters the empty criminal application table", () => {
    const all = getApplicationRows("CRIMINAL_LAW_PROCEDURE");
    assert.equal(all.length, 0);
    const homicide = getApplicationRows("CRIMINAL_LAW_PROCEDURE", { subtopic: "Homicide" });
    assert.equal(homicide.length, 0);
    const needsHuman = getApplicationRows("CRIMINAL_LAW_PROCEDURE", { status: "NEEDS_HUMAN" });
    assert.equal(needsHuman.length, 0);
  });
});

describe("c3-subjects validation (acceptance criteria as code)", () => {
  it("criminal reset package passes empty-state invariants", () => {
    const r = validateCriminal();
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
  });

  it("real property reset package passes empty-state invariants", () => {
    const r = validateRealProperty();
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
  });

  it("all subjects valid", () => {
    assert.equal(validateAllSubjects().ok, true);
  });
});

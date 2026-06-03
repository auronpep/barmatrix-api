import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listSubjects, getOverlay, getCards, getDrills, getApplicationRows, getResidue, isSubjectCode,
} from "./c3-subjects.js";
import { validateCriminal, validateRealProperty, validateAllSubjects } from "./c3-subjects-validate.js";

describe("c3-subjects loader", () => {
  it("lists both subjects with non-empty content", () => {
    const subjects = listSubjects();
    assert.equal(subjects.length, 2);
    const crim = subjects.find((s) => s.code === "CRIMINAL_LAW_PROCEDURE")!;
    assert.equal(crim.application_rows, 151);
    assert.ok(crim.cards > 0 && crim.drills > 0);
    assert.match(crim.student_mantra, /Output first/i);
    const rp = subjects.find((s) => s.code === "REAL_PROPERTY")!;
    assert.equal(rp.lessons, 6);
    assert.ok(rp.cards > 0 && rp.drills > 0);
    assert.match(rp.student_mantra, /Source\. Status\. Event\. Consequence/i);
  });

  it("isSubjectCode guards", () => {
    assert.equal(isSubjectCode("CRIMINAL_LAW_PROCEDURE"), true);
    assert.equal(isSubjectCode("REAL_PROPERTY"), true);
    assert.equal(isSubjectCode("EVIDENCE"), false);
  });

  it("serves overlay, cards, drills, residue", () => {
    assert.ok(getOverlay("CRIMINAL_LAW_PROCEDURE"));
    assert.ok(getCards("CRIMINAL_LAW_PROCEDURE").length > 0);
    assert.ok(getDrills("REAL_PROPERTY").length > 0);
    assert.ok(getResidue("CRIMINAL_LAW_PROCEDURE"));
  });

  it("filters the criminal application table", () => {
    const all = getApplicationRows("CRIMINAL_LAW_PROCEDURE");
    assert.equal(all.length, 151);
    const homicide = getApplicationRows("CRIMINAL_LAW_PROCEDURE", { subtopic: "Homicide" });
    assert.equal(homicide.length, 26);
    const needsHuman = getApplicationRows("CRIMINAL_LAW_PROCEDURE", { status: "NEEDS_HUMAN" });
    assert.equal(needsHuman.length, 1);
    assert.equal(needsHuman[0]!.qid, "14650");
  });
});

describe("c3-subjects validation (acceptance criteria as code)", () => {
  it("criminal package passes all invariants (151 rows, Q14650, counts)", () => {
    const r = validateCriminal();
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
  });

  it("real property package passes residue + content invariants", () => {
    const r = validateRealProperty();
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
  });

  it("all subjects valid", () => {
    assert.equal(validateAllSubjects().ok, true);
  });
});

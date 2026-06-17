// Validators for staged C3 subject content — encode the packages' acceptance
// criteria / validation_checks as runnable assertions (Criminal §validation_checks,
// RP §RP_ACCEPTANCE_CRITERIA). Pure; unit-tested.
import { _raw, type SubjectCard, type SubjectDrill, type ApplicationRow } from "./c3-subjects.js";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// Every card must carry the required method fields (no empty teaching cards).
export function validateCards(cards: SubjectCard[]): string[] {
  const errors: string[] = [];
  for (const c of cards) {
    for (const field of ["id", "type", "title", "signal", "student_move", "trap", "confidence"] as const) {
      if (!c[field]) errors.push(`card ${c.id || "?"} missing ${field}`);
    }
  }
  return errors;
}

export function validateDrills(drills: SubjectDrill[]): string[] {
  const errors: string[] = [];
  for (const d of drills) {
    if (!d.id) errors.push("drill missing id");
    if (!d.title) errors.push(`drill ${d.id} missing title`);
    // pass_criterion is intentionally nullable (e.g. RP "Anchor Honesty" drills).
  }
  return errors;
}

// Criminal: data/criminal validation_checks.md
export function validateCriminal(): ValidationResult {
  const errors: string[] = [];
  const rows = _raw.criminalRows as ApplicationRow[];
  const counts = _raw.criminalCounts as {
    total_rows?: number;
    subtopic_counts?: Record<string, number>;
    status_counts?: Record<string, number>;
  };
  const residue = _raw.criminalResidue as { needs_human?: { qid: string }[] };

  const isContentReset =
    rows.length === 0 &&
    _raw.criminalCards.length === 0 &&
    _raw.criminalDrills.length === 0 &&
    Object.keys(counts).length === 0 &&
    Object.keys(residue).length === 0;
  if (isContentReset) return { ok: true, errors };

  if (rows.length !== 151) errors.push(`expected 151 application rows, got ${rows.length}`);
  const uniqueQids = new Set(rows.map((r) => r.qid));
  if (uniqueQids.size !== 151) errors.push(`expected 151 unique QIDs, got ${uniqueQids.size}`);

  const q14650 = rows.find((r) => r.qid === "14650");
  if (!q14650) errors.push("Q14650 missing from application table");
  else if (q14650.status !== "NEEDS_HUMAN") errors.push(`Q14650 must be NEEDS_HUMAN, got ${q14650.status}`);

  // Status counts must match the package summary exactly.
  const liveStatus = countBy(rows, (r) => r.status);
  for (const [status, expected] of Object.entries(counts.status_counts ?? {})) {
    if ((liveStatus[status] ?? 0) !== expected) {
      errors.push(`status '${status}': expected ${expected}, got ${liveStatus[status] ?? 0}`);
    }
  }
  // Subtopic counts must match.
  const liveSub = countBy(rows, (r) => r.subtopic);
  for (const [sub, expected] of Object.entries(counts.subtopic_counts ?? {})) {
    if ((liveSub[sub] ?? 0) !== expected) {
      errors.push(`subtopic '${sub}': expected ${expected}, got ${liveSub[sub] ?? 0}`);
    }
  }

  // Residue: Q14650 must be in needs_human and NOT in any clean teaching queue.
  if (!(residue.needs_human ?? []).some((r) => r.qid === "14650")) {
    errors.push("Q14650 must appear in residue.needs_human");
  }

  // PURE ANCHOR rows must never be described as hard structural.
  for (const r of rows) {
    if (r.call_class.includes("PURE ANCHOR") && r.call_class.includes("HARD STRUCTURAL")) {
      errors.push(`Q${r.qid}: PURE ANCHOR row labeled HARD STRUCTURAL`);
    }
  }

  errors.push(...validateCards(_raw.criminalCards));
  errors.push(...validateDrills(_raw.criminalDrills));
  return { ok: errors.length === 0, errors };
}

// RP: RP_ACCEPTANCE_CRITERIA — residue handling + content presence.
export function validateRealProperty(): ValidationResult {
  const errors: string[] = [];
  const manifest = _raw.rpManifest as {
    lessons?: unknown[];
    residue?: {
      fork_or_split?: number[];
      promote_from_manual_to_anchor_assisted?: number[];
      calibrated_partition_candidate?: number[];
    };
  };

  const lessons = manifest.lessons ?? [];
  const residue = manifest.residue ?? {};
  const isContentReset =
    (manifest as { version?: unknown }).version === "content-reset" &&
    lessons.length === 0 &&
    _raw.rpCards.length === 0 &&
    _raw.rpDrills.length === 0 &&
    Object.keys(residue).length === 0;
  if (isContentReset) return { ok: true, errors };

  if (lessons.length !== 6) errors.push(`expected 6 RP lessons (RP-00..RP-05), got ${lessons.length}`);

  if (!(residue.fork_or_split ?? []).includes(14984)) {
    errors.push("RP Q14984 must be FORK_OR_SPLIT (residue.fork_or_split)");
  }
  for (const qid of [14935, 15010, 15024]) {
    if (!(residue.promote_from_manual_to_anchor_assisted ?? []).includes(qid)) {
      errors.push(`RP Q${qid} must be a promoted anchor-assisted row`);
    }
  }
  if (!(residue.calibrated_partition_candidate ?? []).includes(15032)) {
    errors.push("RP Q15032 must be a calibrated partition candidate");
  }

  if (_raw.rpCards.length === 0) errors.push("RP cards failed to load");
  if (_raw.rpDrills.length === 0) errors.push("RP drills failed to load");

  errors.push(...validateCards(_raw.rpCards));
  errors.push(...validateDrills(_raw.rpDrills));
  return { ok: errors.length === 0, errors };
}

export function validateAllSubjects(): ValidationResult {
  const crim = validateCriminal();
  const rp = validateRealProperty();
  return { ok: crim.ok && rp.ok, errors: [...crim.errors, ...rp.errors] };
}

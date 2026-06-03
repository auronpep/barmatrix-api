// C3 Subject Overlays — typed, indexed access to subject method content
// (overlays, cards, drills, application tables, residue, weakspots) staged from
// the implementation packages under src/data/c3-subjects/.
//
// Method content only — NO question stems and NO DB. Subject drills reference
// source-workbook integer QIDs that are not yet linked to the live UUID bank
// (see MASTER_PLAN Phase 3), so drill.qid_pool is a list of source QIDs, served
// as-is for display until the crosswalk lands.

import criminalOverlay from "../data/c3-subjects/criminal/criminal_overlay.json" with { type: "json" };
import criminalApplication from "../data/c3-subjects/criminal/criminal_law_application_table.json" with { type: "json" };
import criminalCardsRaw from "../data/c3-subjects/criminal/criminal_cards.json" with { type: "json" };
import criminalDrillsRaw from "../data/c3-subjects/criminal/criminal_drills.json" with { type: "json" };
import criminalResidue from "../data/c3-subjects/criminal/criminal_residue.json" with { type: "json" };
import criminalCounts from "../data/c3-subjects/criminal/summary_counts.json" with { type: "json" };
import rpManifest from "../data/c3-subjects/rp/rp_manifest.json" with { type: "json" };
import rpCardsRaw from "../data/c3-subjects/rp/rp_cards.json" with { type: "json" };
import rpDrillsRaw from "../data/c3-subjects/rp/rp_drills.json" with { type: "json" };
import rpWeakspots from "../data/c3-subjects/rp/rp_adaptive_weakspots.json" with { type: "json" };

export type SubjectCode = "CRIMINAL_LAW_PROCEDURE" | "REAL_PROPERTY";

export interface SubjectCard {
  id: string;
  type: string; // CUT | CLASH | CALL | ANCHOR | META
  title: string;
  signal: string;
  student_move: string;
  trap: string;
  confidence: string;
  example_qids: string[];
  lesson?: string;
}

export interface SubjectDrill {
  id: string;
  subject_code: SubjectCode;
  lesson?: string;
  title: string;
  skill?: string;
  task?: string;
  qid_pool: string[]; // source-workbook QIDs (not live question_ids yet)
  cards: string[];
  pass_criterion?: string | null;
}

export interface ApplicationRow {
  qid: string;
  key: string;
  subject: string;
  subtopic: string;
  question_shape: string;
  dominant_cut: string;
  clash_shape: string;
  call_class: string;
  pattern_code: string;
  status: string;
  notes: string;
}

export interface SubjectSummary {
  code: SubjectCode;
  name: string;
  fit: string;
  student_mantra: string;
  dominant_call: string;
  cards: number;
  drills: number;
  application_rows: number;
  lessons: number;
}

const asStr = (v: unknown): string => (v == null ? "" : String(v));
const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)) : [];

function normalizeCard(c: Record<string, unknown>): SubjectCard {
  return {
    id: asStr(c.id),
    type: asStr(c.type),
    title: asStr(c.title),
    signal: asStr(c.signal),
    student_move: asStr(c.student_move),
    trap: asStr(c.trap),
    confidence: asStr(c.confidence),
    example_qids: asStrArr(c.example_qids),
    ...(c.lesson != null ? { lesson: asStr(c.lesson) } : {}),
  };
}

function normalizeDrill(d: Record<string, unknown>, code: SubjectCode): SubjectDrill {
  const passRaw = d.pass_criterion;
  return {
    id: asStr(d.id),
    subject_code: code,
    ...(d.lesson != null ? { lesson: asStr(d.lesson) } : {}),
    title: asStr(d.title ?? d.name),
    ...(d.skill != null ? { skill: asStr(d.skill) } : {}),
    task: asStr(d.task ?? d.objective) || undefined,
    qid_pool: asStrArr(d.qid_pool ?? d.qids),
    cards: asStrArr(d.cards),
    pass_criterion: passRaw == null ? null : asStr(passRaw),
  };
}

// ── Normalized collections ──────────────────────────────────────────────────

const criminalCards: SubjectCard[] = (criminalCardsRaw as Record<string, unknown>[]).map(normalizeCard);
const criminalDrills: SubjectDrill[] = (criminalDrillsRaw as Record<string, unknown>[]).map((d) =>
  normalizeDrill(d, "CRIMINAL_LAW_PROCEDURE"),
);
const criminalRows: ApplicationRow[] = criminalApplication as unknown as ApplicationRow[];

const rpCards: SubjectCard[] = (rpCardsRaw as Record<string, unknown>[]).map(normalizeCard);
const rpDrills: SubjectDrill[] = (rpDrillsRaw as Record<string, unknown>[]).map((d) =>
  normalizeDrill(d, "REAL_PROPERTY"),
);
const rpLessons = (rpManifest as { lessons?: unknown[] }).lessons ?? [];

// ── Public accessors ──────────────────────────────────────────────────────────

export function listSubjects(): SubjectSummary[] {
  return [
    {
      code: "CRIMINAL_LAW_PROCEDURE",
      name: asStr((criminalOverlay as Record<string, unknown>).subject) || "Criminal Law and Procedure",
      fit: asStr((criminalOverlay as Record<string, unknown>).fit),
      student_mantra: asStr((criminalOverlay as Record<string, unknown>).student_mantra),
      dominant_call: asStr((criminalOverlay as Record<string, unknown>).dominant_call),
      cards: criminalCards.length,
      drills: criminalDrills.length,
      application_rows: criminalRows.length,
      lessons: 0, // criminal package ships as overlay + subtopic passes, not a lesson registry
    },
    {
      code: "REAL_PROPERTY",
      name: asStr((rpManifest as Record<string, unknown>).subject) || "Real Property",
      fit: asStr((rpManifest as Record<string, unknown>).fit),
      student_mantra: asStr((rpManifest as Record<string, unknown>).student_mantra),
      dominant_call: asStr((rpManifest as Record<string, unknown>).dominant_call),
      cards: rpCards.length,
      drills: rpDrills.length,
      application_rows: 0, // RP uses microtemplates instead of a flat application table
      lessons: rpLessons.length,
    },
  ];
}

export function getOverlay(code: SubjectCode): Record<string, unknown> | null {
  if (code === "CRIMINAL_LAW_PROCEDURE") return criminalOverlay as Record<string, unknown>;
  if (code === "REAL_PROPERTY") return rpManifest as Record<string, unknown>;
  return null;
}

export function getCards(code: SubjectCode): SubjectCard[] {
  if (code === "CRIMINAL_LAW_PROCEDURE") return criminalCards;
  if (code === "REAL_PROPERTY") return rpCards;
  return [];
}

export function getDrills(code: SubjectCode): SubjectDrill[] {
  if (code === "CRIMINAL_LAW_PROCEDURE") return criminalDrills;
  if (code === "REAL_PROPERTY") return rpDrills;
  return [];
}

export interface ApplicationFilter {
  subtopic?: string;
  status?: string;
  call_class?: string;
  pattern_code?: string;
}

export function getApplicationRows(code: SubjectCode, filter: ApplicationFilter = {}): ApplicationRow[] {
  if (code !== "CRIMINAL_LAW_PROCEDURE") return [];
  return criminalRows.filter((r) =>
    (filter.subtopic ? r.subtopic === filter.subtopic : true) &&
    (filter.status ? r.status === filter.status : true) &&
    (filter.call_class ? r.call_class === filter.call_class : true) &&
    (filter.pattern_code ? r.pattern_code === filter.pattern_code : true),
  );
}

export function getResidue(code: SubjectCode): Record<string, unknown> | null {
  if (code === "CRIMINAL_LAW_PROCEDURE") return criminalResidue as Record<string, unknown>;
  if (code === "REAL_PROPERTY") {
    const residue = (rpManifest as { residue?: Record<string, unknown> }).residue ?? {};
    return residue;
  }
  return null;
}

export function getWeakspots(code: SubjectCode): Record<string, unknown> | null {
  if (code === "REAL_PROPERTY") return rpWeakspots as Record<string, unknown>;
  return null;
}

export function isSubjectCode(x: string): x is SubjectCode {
  return x === "CRIMINAL_LAW_PROCEDURE" || x === "REAL_PROPERTY";
}

// Raw exports for validators/tests.
export const _raw = {
  criminalRows,
  criminalCards,
  criminalDrills,
  criminalResidue: criminalResidue as Record<string, unknown>,
  criminalCounts: criminalCounts as Record<string, unknown>,
  rpManifest: rpManifest as Record<string, unknown>,
  rpCards,
  rpDrills,
  rpWeakspots: rpWeakspots as Record<string, unknown>,
};

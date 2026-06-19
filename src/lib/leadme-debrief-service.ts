import type { DbPool } from "../db.js";

type Queryable = Pick<DbPool, "query">;

interface DebriefElementRow {
  element_id: string;
  element_type: string;
  title: string;
  status: string;
  subject: string | null;
  primary_outline_code: string | null;
  method_phase: string | null;
  method_class: string | null;
  governing_law_type: string | null;
  source_count: number | string | null;
  review_status: string | null;
  yaml_json_text: string;
}

interface DebriefElementDocument {
  identity?: {
    element_id?: string;
    element_type?: string;
    title?: string;
  };
  content?: {
    student_signal?: string;
    axis?: string;
    splitting_fact?: string;
    review_truth?: string;
    student_script?: string;
  };
  choice_links?: {
    credited_choice?: string;
    dominant_trap_choice?: string;
    survivor_pair?: string[];
  };
  leadme_exports?: {
    default_detour_item_id?: string;
  };
}

export interface ReadLeadMeDebriefInput {
  subject: string;
  primaryOutlineCode: string;
  selectedResponse: string;
  correctResponse: string | readonly string[] | null;
}

export interface LeadMeDebriefElement {
  element_id: string;
  element_type: string;
  title: string;
  method_phase: string | null;
  student_signal: string | null;
  axis: string | null;
  splitting_fact: string | null;
  review_truth: string | null;
  student_script: string | null;
  default_detour_item_id: string | null;
}

export interface LeadMeDebriefIntelligence {
  auto_expand_sections: string[];
  auto_expand_choices: string[];
  elements: LeadMeDebriefElement[];
}

export interface DebriefIntelElement extends LeadMeDebriefElement {
  subject: string | null;
  primary_outline_code: string | null;
  method_class: string | null;
  governing_law_type: string | null;
  source_count: number;
}

export interface ReadDebriefIntelElementsInput {
  type?: string;
  outlineCode?: string;
  limit?: number;
}

const STUDENT_SAFE_STATUSES = new Set(["active", "core"]);
const REVIEWED_STATUSES = new Set(["approved", "reviewed", "legal_reviewed", "active"]);

function parseElement(row: DebriefElementRow): DebriefElementDocument | null {
  try {
    const parsed = JSON.parse(row.yaml_json_text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as DebriefElementDocument;
  } catch {
    return null;
  }
}

function firstCorrect(correctResponse: string | readonly string[] | null): string | null {
  if (typeof correctResponse === "string") return correctResponse;
  return correctResponse?.[0] ?? null;
}

function appliesToSelection(
  doc: DebriefElementDocument,
  input: ReadLeadMeDebriefInput,
): boolean {
  const links = doc.choice_links;
  if (!links) return true;
  if (links.dominant_trap_choice === input.selectedResponse) return true;
  if (links.credited_choice === input.selectedResponse) return true;
  return links.survivor_pair?.includes(input.selectedResponse) ?? false;
}

function projectElement(row: DebriefElementRow, doc: DebriefElementDocument): LeadMeDebriefElement {
  const identity = doc.identity ?? {};
  const content = doc.content ?? {};
  return {
    element_id: identity.element_id ?? row.element_id,
    element_type: identity.element_type ?? row.element_type,
    title: identity.title ?? row.title,
    method_phase: row.method_phase,
    student_signal: content.student_signal ?? null,
    axis: content.axis ?? null,
    splitting_fact: content.splitting_fact ?? null,
    review_truth: content.review_truth ?? null,
    student_script: content.student_script ?? null,
    default_detour_item_id: doc.leadme_exports?.default_detour_item_id ?? null,
  };
}

function rowSourceCount(row: DebriefElementRow): number {
  const parsed = Number(row.source_count ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function projectIntelElement(
  row: DebriefElementRow,
  doc: DebriefElementDocument,
): DebriefIntelElement {
  return {
    ...projectElement(row, doc),
    subject: row.subject,
    primary_outline_code: row.primary_outline_code,
    method_class: row.method_class,
    governing_law_type: row.governing_law_type,
    source_count: rowSourceCount(row),
  };
}

function isStudentSafe(row: DebriefElementRow): boolean {
  return (
    STUDENT_SAFE_STATUSES.has(row.status) &&
    !!row.review_status &&
    REVIEWED_STATUSES.has(row.review_status)
  );
}

function selectDebriefElementColumns(): string {
  return `element_id, element_type, title, status, subject, primary_outline_code,
          method_phase, method_class, governing_law_type, source_count,
          review_status, yaml_json_text`;
}

export async function readDebriefIntelElements(
  db: Queryable,
  input: ReadDebriefIntelElementsInput = {},
): Promise<DebriefIntelElement[]> {
  const values: unknown[] = [];
  const where = [
    "status IN ('active', 'core')",
    "review_status IN ('approved', 'reviewed', 'legal_reviewed', 'active')",
  ];
  if (input.type) {
    values.push(input.type);
    where.push(`element_type = $${values.length}`);
  }
  if (input.outlineCode) {
    values.push(input.outlineCode);
    where.push(`primary_outline_code = $${values.length}`);
  }
  values.push(Math.min(Math.max(input.limit ?? 50, 1), 100));

  const { rows } = await db.query<DebriefElementRow>(
    `SELECT ${selectDebriefElementColumns()}
       FROM debrief_elements
      WHERE ${where.join(" AND ")}
      ORDER BY source_count DESC, element_id ASC
      LIMIT $${values.length}`,
    values,
  );

  const elements: DebriefIntelElement[] = [];
  for (const row of rows) {
    if (!isStudentSafe(row)) continue;
    const doc = parseElement(row);
    if (doc) elements.push(projectIntelElement(row, doc));
  }
  return elements;
}

export async function readDebriefIntelElementById(
  db: Queryable,
  elementId: string,
): Promise<DebriefIntelElement | null> {
  const { rows } = await db.query<DebriefElementRow>(
    `SELECT ${selectDebriefElementColumns()}
       FROM debrief_elements
      WHERE element_id = $1
        AND status IN ('active', 'core')
        AND review_status IN ('approved', 'reviewed', 'legal_reviewed', 'active')
      LIMIT 1`,
    [elementId],
  );
  const row = rows[0];
  if (!row || !isStudentSafe(row)) return null;
  const doc = parseElement(row);
  return doc ? projectIntelElement(row, doc) : null;
}

export async function readLeadMeDebriefIntelligence(
  db: Queryable,
  input: ReadLeadMeDebriefInput,
): Promise<LeadMeDebriefIntelligence> {
  const { rows } = await db.query<DebriefElementRow>(
    `SELECT element_id, element_type, title, status, subject, primary_outline_code,
            method_phase, method_class, governing_law_type, source_count,
            review_status, yaml_json_text
       FROM debrief_elements
      WHERE subject = $1
        AND primary_outline_code = $2
        AND status IN ('active', 'core')
        AND review_status IN ('approved', 'reviewed', 'legal_reviewed', 'active')
      ORDER BY source_count DESC, element_id ASC
      LIMIT 20`,
    [input.subject, input.primaryOutlineCode],
  );

  const elements: LeadMeDebriefElement[] = [];
  for (const row of rows) {
    if (!STUDENT_SAFE_STATUSES.has(row.status)) continue;
    if (!row.review_status || !REVIEWED_STATUSES.has(row.review_status)) continue;
    const doc = parseElement(row);
    if (!doc || !appliesToSelection(doc, input)) continue;
    elements.push(projectElement(row, doc));
  }

  const correct = firstCorrect(input.correctResponse);
  return {
    auto_expand_sections: ["solve.clash", `molds.choice_${input.selectedResponse}`],
    auto_expand_choices: [
      input.selectedResponse,
      ...(correct && correct !== input.selectedResponse ? [correct] : []),
    ],
    elements,
  };
}

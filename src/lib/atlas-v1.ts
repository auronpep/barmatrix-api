import { randomUUID } from "node:crypto";
import type { DbPool } from "../db.js";

type Queryable = Pick<DbPool, "query">;

export type AtlasV1QuestionStatus = "review" | "included" | "rejected" | "retired";
export type AtlasV1CoverageState = "missing" | "in_review" | "covered";
export type AtlasV1DetourVisibility = "student" | "admin_only";

const QUESTION_STATUSES = new Set<AtlasV1QuestionStatus>([
  "review",
  "included",
  "rejected",
  "retired",
]);

const CASE_STUDY_MODULES = [
  "hero_verdict",
  "question_card",
  "fork",
  "solve",
  "facts",
  "traps_wrong_answer_log",
  "bank_it",
  "repair",
  "detours",
] as const;

const CASE_STUDY_MODULE_SET = new Set<string>(CASE_STUDY_MODULES);

export class AtlasV1ValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join("; "));
    this.name = "AtlasV1ValidationError";
    this.errors = errors;
  }
}

interface AtlasV1CoverageRow {
  code: string;
  parent_code: string | null;
  subject: string;
  subject_display: string;
  subtopic: string;
  outline_text: string;
  display_label: string;
  level: number | string;
  leaf: number | string;
  included_count: number | string | null;
  review_count: number | string | null;
  last_included_at: string | Date | null;
}

export interface AtlasV1CoverageNode {
  code: string;
  parent_code: string | null;
  subject: string;
  subject_display: string;
  subtopic: string;
  outline_text: string;
  display_label: string;
  level: number;
  leaf: boolean;
  included_count: number;
  review_count: number;
  coverage_state: AtlasV1CoverageState;
  last_included_at: string | null;
}

export interface AtlasV1CoverageResponse {
  nodes: AtlasV1CoverageNode[];
  summary: Record<AtlasV1CoverageState, number> & { total: number };
}

export interface AtlasV1CoverageInput {
  subject?: string;
  subtopic?: string;
  coverageState?: AtlasV1CoverageState;
  questionStatus?: AtlasV1QuestionStatus;
  limit?: number;
}

export interface AtlasV1QuestionInput {
  question_id?: string;
  outline_code: string;
  status?: AtlasV1QuestionStatus;
  stem: string;
  call_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  minimum_explanation: string;
  source_label?: string | null;
  source_ref?: string | null;
  source_hash?: string | null;
  case_study_json?: unknown;
  included_by?: string | null;
}

export interface AtlasV1QuestionWriteResult {
  question_id: string;
  outline_code: string;
  status: AtlasV1QuestionStatus;
}

interface AtlasV1QuestionListRow {
  question_id: string;
  outline_code: string;
  status: AtlasV1QuestionStatus;
  stem: string;
  call_text: string;
  correct_answer: string;
  source_label: string | null;
  source_ref: string | null;
  included_at: string | Date | null;
  updated_at: string | Date | null;
}

export interface AtlasV1QuestionListItem {
  question_id: string;
  outline_code: string;
  status: AtlasV1QuestionStatus;
  stem: string;
  call_text: string;
  correct_answer: string;
  source_label: string | null;
  source_ref: string | null;
  included_at: string | null;
  updated_at: string | null;
}

export interface AtlasV1QuestionListResponse {
  items: AtlasV1QuestionListItem[];
}

export interface AtlasV1StudentCoverageNode {
  code: string;
  parent_code: string | null;
  subject: string;
  subject_display: string;
  subtopic: string;
  outline_text: string;
  display_label: string;
  level: number;
  leaf: boolean;
  question_count: number;
}

export interface AtlasV1StudentCoverageResponse {
  nodes: AtlasV1StudentCoverageNode[];
  summary: { total: number; with_questions: number };
}

export interface AtlasV1StudentQuestionListItem {
  question_id: string;
  outline_code: string;
  stem: string;
  call_text: string;
}

export interface AtlasV1StudentQuestionListResponse {
  items: AtlasV1StudentQuestionListItem[];
}

export interface AtlasV1QuestionListInput {
  outline_code?: string;
  status?: AtlasV1QuestionStatus;
  limit?: number;
}

export interface AtlasV1QuestionStatusInput {
  question_id: string;
  status: AtlasV1QuestionStatus;
  included_by?: string | null;
}

export interface AtlasV1QuestionStatusResult {
  question_id: string;
  status: AtlasV1QuestionStatus;
  updated: boolean;
}

export interface AtlasV1AnswerRow {
  question_id: string;
  outline_code: string;
  outline_text: string;
  subject_display: string;
  subtopic: string;
  stem: string;
  call_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  minimum_explanation: string;
  case_study_json?: unknown;
}

export interface AtlasV1Answer {
  question: {
    question_id: string;
    outline_code: string;
    outline_text: string;
    subject_display: string;
    subtopic: string;
    stem: string;
    call_text: string;
    choices: Record<"A" | "B" | "C" | "D", string>;
    correct_answer: string;
    minimum_explanation: string;
  };
  case_study_modules: Record<string, unknown>;
}

export interface AtlasV1DetourSpec {
  type: string;
  key: string;
  label: string;
  target_count?: number;
  visibility?: AtlasV1DetourVisibility;
}

export interface AtlasV1Detour {
  type: string;
  key: string;
  label: string;
  target_count: number;
  visibility: AtlasV1DetourVisibility;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrZero(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function coverageState(includedCount: number, reviewCount: number): AtlasV1CoverageState {
  if (includedCount > 0) return "covered";
  if (reviewCount > 0) return "in_review";
  return "missing";
}

function mapCoverageRow(row: AtlasV1CoverageRow): AtlasV1CoverageNode {
  const includedCount = numberOrZero(row.included_count);
  const reviewCount = numberOrZero(row.review_count);
  return {
    code: row.code,
    parent_code: row.parent_code,
    subject: row.subject,
    subject_display: row.subject_display,
    subtopic: row.subtopic,
    outline_text: row.outline_text,
    display_label: row.display_label,
    level: numberOrZero(row.level),
    leaf: numberOrZero(row.leaf) === 1,
    included_count: includedCount,
    review_count: reviewCount,
    coverage_state: coverageState(includedCount, reviewCount),
    last_included_at: isoOrNull(row.last_included_at),
  };
}

export async function readAtlasV1Coverage(
  db: Queryable,
  input: AtlasV1CoverageInput = {},
): Promise<AtlasV1CoverageResponse> {
  const where = ["n.status = 'active'"];
  const values: unknown[] = [];
  const subject = clean(input.subject);
  const subtopic = clean(input.subtopic);
  const limit = Math.min(Math.max(input.limit ?? 1000, 1), 1000);

  if (subject) {
    values.push(subject);
    where.push(`(n.subject = $${values.length} OR n.subject_display = $${values.length})`);
  }
  if (subtopic) {
    values.push(subtopic);
    where.push(`n.subtopic = $${values.length}`);
  }
  if (input.questionStatus) {
    if (!QUESTION_STATUSES.has(input.questionStatus)) {
      throw new AtlasV1ValidationError(["invalid question status filter"]);
    }
    values.push(input.questionStatus);
    where.push(
      `EXISTS (SELECT 1 FROM atlas_questions qs WHERE qs.outline_code = n.code AND qs.status = $${values.length})`,
    );
  }

  values.push(limit);
  const sql = `SELECT n.code, n.parent_code, n.subject, n.subject_display, n.subtopic,
              n.outline_text, n.display_label, n.level, n.leaf,
              SUM(CASE WHEN q.status = 'included' THEN 1 ELSE 0 END) AS included_count,
              SUM(CASE WHEN q.status = 'review' THEN 1 ELSE 0 END) AS review_count,
              MAX(CASE WHEN q.status = 'included' THEN q.included_at ELSE NULL END) AS last_included_at
         FROM atlas_outline_nodes n
         LEFT JOIN atlas_questions q
           ON q.outline_code = n.code
        WHERE ${where.join(" AND ")}
        GROUP BY n.code, n.parent_code, n.subject, n.subject_display, n.subtopic,
                 n.outline_text, n.display_label, n.level, n.leaf, n.sort_order
        ORDER BY
          CASE
            WHEN SUM(CASE WHEN q.status = 'included' THEN 1 ELSE 0 END) = 0
             AND SUM(CASE WHEN q.status = 'review' THEN 1 ELSE 0 END) = 0 THEN 0
            WHEN SUM(CASE WHEN q.status = 'included' THEN 1 ELSE 0 END) = 0
             AND SUM(CASE WHEN q.status = 'review' THEN 1 ELSE 0 END) > 0 THEN 1
            ELSE 2
          END ASC,
          n.subject_display ASC, n.subtopic ASC, n.sort_order ASC
        LIMIT $${values.length}`;

  const { rows } = await db.query<AtlasV1CoverageRow>(sql, values);
  const nodes = rows.map(mapCoverageRow).filter((node) => {
    return input.coverageState ? node.coverage_state === input.coverageState : true;
  });
  const summary = { missing: 0, in_review: 0, covered: 0, total: nodes.length };
  for (const node of nodes) {
    summary[node.coverage_state] += 1;
  }
  return { nodes, summary };
}

export async function readAtlasV1Questions(
  db: Queryable,
  input: AtlasV1QuestionListInput = {},
): Promise<AtlasV1QuestionListResponse> {
  const where: string[] = [];
  const values: unknown[] = [];
  const outlineCode = clean(input.outline_code);
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  if (outlineCode) {
    if (!/^[0-9]{8}$/.test(outlineCode)) {
      throw new AtlasV1ValidationError(["outline_code must be 8 digits"]);
    }
    values.push(outlineCode);
    where.push(`q.outline_code = $${values.length}`);
  }
  if (input.status) {
    if (!QUESTION_STATUSES.has(input.status)) {
      throw new AtlasV1ValidationError(["status is invalid"]);
    }
    values.push(input.status);
    where.push(`q.status = $${values.length}`);
  }

  values.push(limit);
  const { rows } = await db.query<AtlasV1QuestionListRow>(
    `SELECT q.question_id, q.outline_code, q.status, q.stem, q.call_text,
            q.correct_answer, q.source_label, q.source_ref, q.included_at, q.updated_at
       FROM atlas_questions q
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY q.updated_at DESC, q.question_id ASC
      LIMIT $${values.length}`,
    values,
  );

  return {
    items: rows.map((row) => ({
      question_id: row.question_id,
      outline_code: row.outline_code,
      status: row.status,
      stem: row.stem,
      call_text: row.call_text,
      correct_answer: row.correct_answer,
      source_label: row.source_label,
      source_ref: row.source_ref,
      included_at: isoOrNull(row.included_at),
      updated_at: isoOrNull(row.updated_at),
    })),
  };
}

export async function readAtlasV1StudentCoverage(
  db: Queryable,
  input: Omit<AtlasV1CoverageInput, "coverageState" | "questionStatus"> = {},
): Promise<AtlasV1StudentCoverageResponse> {
  const coverage = await readAtlasV1Coverage(db, input);
  const nodes = coverage.nodes.map((node) => ({
    code: node.code,
    parent_code: node.parent_code,
    subject: node.subject,
    subject_display: node.subject_display,
    subtopic: node.subtopic,
    outline_text: node.outline_text,
    display_label: node.display_label,
    level: node.level,
    leaf: node.leaf,
    question_count: node.included_count,
  }));

  return {
    nodes,
    summary: {
      total: nodes.length,
      with_questions: nodes.filter((node) => node.question_count > 0).length,
    },
  };
}

export async function readAtlasV1StudentQuestions(
  db: Queryable,
  input: Omit<AtlasV1QuestionListInput, "status"> = {},
): Promise<AtlasV1StudentQuestionListResponse> {
  const questions = await readAtlasV1Questions(db, { ...input, status: "included" });
  return {
    items: questions.items.map((question) => ({
      question_id: question.question_id,
      outline_code: question.outline_code,
      stem: question.stem,
      call_text: question.call_text,
    })),
  };
}

function normalizeCaseStudyJson(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    JSON.parse(value);
    return value;
  }
  return JSON.stringify(value);
}

function validateQuestion(input: AtlasV1QuestionInput): Required<Omit<AtlasV1QuestionInput, "case_study_json">> & {
  case_study_json: string | null;
} {
  const status = input.status ?? "review";
  const errors: string[] = [];
  if (!QUESTION_STATUSES.has(status)) errors.push("status is invalid");
  if (!/^[0-9]{8}$/.test(clean(input.outline_code))) errors.push("outline_code must be 8 digits");
  if (!clean(input.stem)) errors.push("stem is required");
  if (!clean(input.call_text)) errors.push("call_text is required");
  if (!clean(input.answer_a)) errors.push("answer_a is required");
  if (!clean(input.answer_b)) errors.push("answer_b is required");
  if (!clean(input.answer_c)) errors.push("answer_c is required");
  if (!clean(input.answer_d)) errors.push("answer_d is required");
  if (!/^[ABCD]$/.test(clean(input.correct_answer))) errors.push("correct_answer must be A, B, C, or D");
  if (!clean(input.minimum_explanation)) errors.push("minimum_explanation is required");
  if (status === "included" && !clean(input.source_label) && !clean(input.source_ref)) {
    errors.push("source_label or source_ref is required for included questions");
  }

  let caseStudyJson: string | null = null;
  try {
    caseStudyJson = normalizeCaseStudyJson(input.case_study_json);
  } catch {
    errors.push("case_study_json must be valid JSON");
  }

  if (errors.length > 0) throw new AtlasV1ValidationError(errors);

  return {
    question_id: clean(input.question_id) || randomUUID(),
    outline_code: clean(input.outline_code),
    status,
    stem: clean(input.stem),
    call_text: clean(input.call_text),
    answer_a: clean(input.answer_a),
    answer_b: clean(input.answer_b),
    answer_c: clean(input.answer_c),
    answer_d: clean(input.answer_d),
    correct_answer: clean(input.correct_answer),
    minimum_explanation: clean(input.minimum_explanation),
    source_label: clean(input.source_label) || null,
    source_ref: clean(input.source_ref) || null,
    source_hash: clean(input.source_hash) || null,
    included_by: clean(input.included_by) || null,
    case_study_json: caseStudyJson,
  };
}

async function assertQuestionsGateApproved(db: Queryable): Promise<void> {
  const { rows } = await db.query<{ status: string }>(
    `SELECT status
       FROM atlas_component_gates
      WHERE component_type = 'question_bank'
        AND lane = 'questions'
      LIMIT 1`,
  );
  if (rows[0]?.status !== "approved") {
    throw new AtlasV1ValidationError(["question_bank/questions lane is not approved"]);
  }
}

async function assertOutlineCodeExists(db: Queryable, code: string): Promise<void> {
  const { rows } = await db.query<{ code: string }>(
    `SELECT code, outline_text, subject, subject_display, subtopic
       FROM atlas_outline_nodes
      WHERE code = $1
        AND status = 'active'
      LIMIT 1`,
    [code],
  );
  if (!rows[0]) {
    throw new AtlasV1ValidationError(["outline_code is not in atlas_outline_nodes"]);
  }
}

export async function submitAtlasV1Question(
  db: Queryable,
  input: AtlasV1QuestionInput,
): Promise<AtlasV1QuestionWriteResult> {
  const question = validateQuestion(input);
  await assertQuestionsGateApproved(db);
  await assertOutlineCodeExists(db, question.outline_code);

  const includedAt = question.status === "included" ? new Date() : null;
  await db.query(
    `INSERT INTO atlas_questions
       (question_id, outline_code, status, stem, call_text,
        answer_a, answer_b, answer_c, answer_d, correct_answer,
        minimum_explanation, source_label, source_ref, source_hash,
        case_study_json, included_at, included_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON DUPLICATE KEY UPDATE
        outline_code = VALUES(outline_code),
        status = VALUES(status),
        stem = VALUES(stem),
        call_text = VALUES(call_text),
        answer_a = VALUES(answer_a),
        answer_b = VALUES(answer_b),
        answer_c = VALUES(answer_c),
        answer_d = VALUES(answer_d),
        correct_answer = VALUES(correct_answer),
        minimum_explanation = VALUES(minimum_explanation),
        source_label = VALUES(source_label),
        source_ref = VALUES(source_ref),
        source_hash = VALUES(source_hash),
        case_study_json = VALUES(case_study_json),
        included_at = VALUES(included_at),
        included_by = VALUES(included_by)`,
    [
      question.question_id,
      question.outline_code,
      question.status,
      question.stem,
      question.call_text,
      question.answer_a,
      question.answer_b,
      question.answer_c,
      question.answer_d,
      question.correct_answer,
      question.minimum_explanation,
      question.source_label,
      question.source_ref,
      question.source_hash,
      question.case_study_json,
      includedAt,
      question.included_by,
    ],
  );

  return {
    question_id: question.question_id,
    outline_code: question.outline_code,
    status: question.status,
  };
}

export async function setAtlasV1QuestionStatus(
  db: Queryable,
  input: AtlasV1QuestionStatusInput,
): Promise<AtlasV1QuestionStatusResult> {
  const questionId = clean(input.question_id);
  const status = input.status;
  const includedBy = clean(input.included_by) || null;
  const errors: string[] = [];
  if (!questionId) errors.push("question_id is required");
  if (!QUESTION_STATUSES.has(status)) errors.push("status is invalid");
  if (errors.length > 0) throw new AtlasV1ValidationError(errors);

  const result = await db.query(
    `UPDATE atlas_questions
        SET status = $1,
            included_at = CASE
              WHEN $1 = 'included' THEN COALESCE(included_at, CURRENT_TIMESTAMP)
              ELSE included_at
            END,
            included_by = CASE
              WHEN $1 = 'included' THEN COALESCE($2, included_by)
              ELSE included_by
            END
      WHERE question_id = $3`,
    [status, includedBy, questionId],
  );

  return {
    question_id: questionId,
    status,
    updated: (result.rowCount ?? 0) > 0,
  };
}

function parseCaseStudyModules(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined || value === "") return {};
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const modules: Record<string, unknown> = {};
  for (const [key, moduleValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (!CASE_STUDY_MODULE_SET.has(key) || isEmptyModule(moduleValue)) continue;
    modules[key] = moduleValue;
  }
  return modules;
}

function isEmptyModule(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

export function shapeAtlasV1Answer(row: AtlasV1AnswerRow): AtlasV1Answer {
  let caseStudyModules: Record<string, unknown>;
  try {
    caseStudyModules = parseCaseStudyModules(row.case_study_json);
  } catch {
    throw new AtlasV1ValidationError(["case_study_json must be valid JSON"]);
  }

  return {
    question: {
      question_id: row.question_id,
      outline_code: row.outline_code,
      outline_text: row.outline_text,
      subject_display: row.subject_display,
      subtopic: row.subtopic,
      stem: row.stem,
      call_text: row.call_text,
      choices: {
        A: row.answer_a,
        B: row.answer_b,
        C: row.answer_c,
        D: row.answer_d,
      },
      correct_answer: row.correct_answer,
      minimum_explanation: row.minimum_explanation,
    },
    case_study_modules: caseStudyModules,
  };
}

export function shapeAtlasV1Detours(
  specs: AtlasV1DetourSpec[],
  includedTargetCounts: Map<string, number>,
  audience: "student" | "admin" = "student",
): AtlasV1Detour[] {
  const out: AtlasV1Detour[] = [];
  for (const spec of specs) {
    const type = clean(spec.type);
    const key = clean(spec.key);
    const label = clean(spec.label);
    if (!type || !key || !label) continue;

    const visibility = spec.visibility === "admin_only" ? "admin_only" : "student";
    const targetCount = includedTargetCounts.get(`${type}:${key}`) ?? 0;
    if (audience === "student" && (visibility === "admin_only" || targetCount <= 0)) continue;

    out.push({
      type,
      key,
      label,
      target_count: targetCount,
      visibility,
    });
  }
  return out;
}

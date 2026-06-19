import { randomUUID } from "node:crypto";
import type { DbPool } from "../db.js";
import {
  readLeadMeDebriefIntelligence,
  type LeadMeDebriefElement,
} from "./leadme-debrief-service.js";

type Queryable = Pick<DbPool, "query">;

interface DebriefRow {
  debrief_id: string;
  qid: string;
  subject: string | null;
  primary_outline_code: string | null;
  correct_letter: string | null;
  dominant_trap_letter: string | null;
  status: string | null;
  version: string | null;
  content_hash: string | null;
}

interface DebriefSectionRow {
  section_id: string;
  section_key: string;
  section_type: string | null;
  title: string | null;
  order_index: number | string | null;
  compiled_json_text: string | null;
}

interface AttemptOverlayRow {
  selected_letter: string | null;
  correct: boolean | 0 | 1 | null;
  metadata: string | Record<string, unknown> | null;
}

export interface StudentDebriefSection {
  section_id: string;
  section_key: string;
  section_type: string | null;
  title: string | null;
  order_index: number;
  payload: unknown;
}

export interface StudentDebrief {
  debrief_id: string;
  qid: string;
  subject: string | null;
  primary_outline_code: string | null;
  status: string | null;
  version: string | null;
  content_hash: string | null;
  sections: StudentDebriefSection[];
}

export interface StudentDebriefOverlay {
  selected_letter: string | null;
  student_path_label: string | null;
  auto_expand_sections: string[];
  auto_expand_choices: string[];
  recommended_detours: string[];
  elements: LeadMeDebriefElement[];
}

export interface StudentDebriefResponse {
  debrief: StudentDebrief;
  student_overlay: StudentDebriefOverlay | null;
}

export interface RecordStudentDebriefEventInput {
  eventId?: string;
  studentId: string;
  qid: string;
  attemptEventId?: string | null;
  eventType: string;
  sectionKey?: string | null;
  elementId?: string | null;
  dwellMs?: number | null;
  payload?: unknown;
}

export interface RecordStudentDebriefEventResult {
  event_id: string;
  debrief_id: string;
}

function numberOrZero(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function objectFromMetadata(value: AttemptOverlayRow["metadata"]): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function sectionFromRow(row: DebriefSectionRow): StudentDebriefSection {
  return {
    section_id: row.section_id,
    section_key: row.section_key,
    section_type: row.section_type,
    title: row.title,
    order_index: numberOrZero(row.order_index),
    payload: parseJson(row.compiled_json_text),
  };
}

async function readDebriefRow(db: Queryable, qid: string): Promise<DebriefRow | null> {
  const { rows } = await db.query<DebriefRow>(
    `SELECT debrief_id, qid, subject, primary_outline_code, correct_letter,
            dominant_trap_letter, status, version, content_hash
       FROM debriefs
      WHERE (qid = $1 OR source_qid = $1)
        AND status IN ('active', 'published')
      ORDER BY updated_at DESC, debrief_id ASC
      LIMIT 1`,
    [qid],
  );
  return rows[0] ?? null;
}

async function readDebriefSections(
  db: Queryable,
  debriefId: string,
): Promise<StudentDebriefSection[]> {
  const { rows } = await db.query<DebriefSectionRow>(
    `SELECT section_id, section_key, section_type, title, order_index, compiled_json_text
      FROM debrief_sections
      WHERE debrief_id = $1
      ORDER BY COALESCE(order_index, 999999), section_key ASC
      LIMIT 20`,
    [debriefId],
  );
  return rows.map(sectionFromRow);
}

async function readOwnedAttemptOverlay(
  db: Queryable,
  input: { studentId: string; qid: string; attemptEventId: string },
): Promise<AttemptOverlayRow | null> {
  const { rows } = await db.query<AttemptOverlayRow>(
    `SELECT selected_letter, correct, metadata
       FROM student_attempts
      WHERE attempt_id = $1
        AND student_id = $2
        AND question_id = $3
      LIMIT 1`,
    [input.attemptEventId, input.studentId, input.qid],
  );
  return rows[0] ?? null;
}

async function ownsDebriefAttempt(
  db: Queryable,
  input: { studentId: string; qid: string; attemptEventId: string },
): Promise<boolean> {
  const { rows } = await db.query<{ attempt_id: string }>(
    `SELECT attempt_id
       FROM student_attempts
      WHERE attempt_id = $1
        AND student_id = $2
        AND question_id = $3
      LIMIT 1`,
    [input.attemptEventId, input.studentId, input.qid],
  );
  return rows.length > 0;
}

async function hasDebriefQuestionAttempt(
  db: Queryable,
  input: { studentId: string; qid: string },
): Promise<boolean> {
  const { rows } = await db.query<{ attempt_id: string }>(
    `SELECT attempt_id
       FROM student_attempts
      WHERE student_id = $1
        AND question_id = $2
      LIMIT 1`,
    [input.studentId, input.qid],
  );
  return rows.length > 0;
}

function pathLabelFromAttempt(row: AttemptOverlayRow): string {
  const metadata = objectFromMetadata(row.metadata);
  return (
    stringField(metadata.student_path_label) ??
    stringField(metadata.branch_id) ??
    (row.correct === true || row.correct === 1 ? "correct_answer_path" : "wrong_answer_forensics")
  );
}

export async function readStudentDebrief(
  db: Queryable,
  input: { studentId: string; qid: string; attemptEventId?: string | null },
): Promise<StudentDebriefResponse | null> {
  const row = await readDebriefRow(db, input.qid);
  if (!row) return null;

  const sections = await readDebriefSections(db, row.debrief_id);
  const debrief: StudentDebrief = {
    debrief_id: row.debrief_id,
    qid: row.qid,
    subject: row.subject,
    primary_outline_code: row.primary_outline_code,
    status: row.status,
    version: row.version,
    content_hash: row.content_hash,
    sections,
  };

  if (!input.attemptEventId || !row.subject || !row.primary_outline_code) {
    return { debrief, student_overlay: null };
  }

  const attempt = await readOwnedAttemptOverlay(db, {
    studentId: input.studentId,
    qid: input.qid,
    attemptEventId: input.attemptEventId,
  });
  if (!attempt?.selected_letter) return { debrief, student_overlay: null };

  const intelligence = await readLeadMeDebriefIntelligence(db, {
    subject: row.subject,
    primaryOutlineCode: row.primary_outline_code,
    selectedResponse: attempt.selected_letter,
    correctResponse: row.correct_letter,
  });

  return {
    debrief,
    student_overlay: {
      selected_letter: attempt.selected_letter,
      student_path_label: pathLabelFromAttempt(attempt),
      auto_expand_sections: intelligence.auto_expand_sections,
      auto_expand_choices: intelligence.auto_expand_choices,
      recommended_detours: intelligence.elements
        .map((element) => element.default_detour_item_id)
        .filter((value): value is string => Boolean(value)),
      elements: intelligence.elements,
    },
  };
}

export async function recordStudentDebriefEvent(
  db: Queryable,
  input: RecordStudentDebriefEventInput,
): Promise<RecordStudentDebriefEventResult | null> {
  const row = await readDebriefRow(db, input.qid);
  if (!row) return null;

  if (input.attemptEventId) {
    if (!(await ownsDebriefAttempt(db, {
      studentId: input.studentId,
      qid: input.qid,
      attemptEventId: input.attemptEventId,
    }))) {
      return null;
    }
  } else if (!(await hasDebriefQuestionAttempt(db, {
    studentId: input.studentId,
    qid: input.qid,
  }))) {
    return null;
  }

  const eventId = input.eventId ?? randomUUID();
  await db.query(
    `INSERT INTO student_debrief_events
       (event_id, student_id, qid, attempt_event_id, debrief_id, section_key,
        element_id, event_type, dwell_ms, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      eventId,
      input.studentId,
      input.qid,
      input.attemptEventId ?? null,
      row.debrief_id,
      input.sectionKey ?? null,
      input.elementId ?? null,
      input.eventType,
      input.dwellMs ?? null,
      input.payload === undefined ? null : JSON.stringify(input.payload),
    ],
  );

  if (input.elementId) {
    const exposureDelta = input.eventType === "element_viewed" ? 1 : 0;
    const detourStartedDelta = input.eventType === "detour_started" ? 1 : 0;
    const detourCompletedDelta = input.eventType === "detour_completed" ? 1 : 0;
    if (exposureDelta > 0) {
      await db.query(
        `INSERT INTO student_debrief_element_state
           (student_id, element_id, exposure_count, last_seen_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           exposure_count = exposure_count + VALUES(exposure_count),
           last_seen_at = CURRENT_TIMESTAMP`,
        [input.studentId, input.elementId, exposureDelta],
      );
    }
    if (exposureDelta + detourStartedDelta + detourCompletedDelta > 0) {
      await db.query(
        `INSERT INTO debrief_element_stats
           (element_id, exposure_count, detour_started_count, detour_completed_count)
         VALUES ($1, $2, $3, $4)
         ON DUPLICATE KEY UPDATE
           exposure_count = exposure_count + VALUES(exposure_count),
           detour_started_count = detour_started_count + VALUES(detour_started_count),
           detour_completed_count = detour_completed_count + VALUES(detour_completed_count)`,
        [input.elementId, exposureDelta, detourStartedDelta, detourCompletedDelta],
      );
    }
  }

  return { event_id: eventId, debrief_id: row.debrief_id };
}

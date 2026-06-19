import type { DbPool } from "../db.js";

type Queryable = Pick<DbPool, "query">;

interface OutlineNodeRow {
  code: string;
  ab: string;
  level: number | string;
  parent_code: string | null;
  label: string;
  path: string;
  status?: string | null;
  mastery_score?: number | string | null;
  confidence?: number | string | null;
  attempts?: number | string | null;
  correct?: number | string | null;
  accuracy?: number | string | null;
  q_available?: number | string | null;
  last_attempt_at?: string | Date | null;
  last_seen_at?: string | Date | null;
  dominant_trap?: string | null;
  dominant_red_zone_id?: string | null;
}

interface OutlineAttachmentRow {
  attachment_type: string;
  attachment_id: string;
  role: string | null;
  status: string | null;
  sort_order: number | string | null;
}

export interface OutlineAttachment {
  attachment_type: string;
  attachment_id: string;
  role: string | null;
  status: string | null;
  sort_order: number | null;
}

export interface StudentOutlineOverlay {
  status: string;
  mastery_score: number | null;
  confidence: number | null;
  attempts: number;
  correct: number;
  accuracy: number | null;
  q_available: number;
  last_attempt_at: string | null;
  last_seen_at: string | null;
  dominant_trap: string | null;
  dominant_red_zone_id: string | null;
}

export interface OutlineAtlasNode {
  code: string;
  ab: string;
  level: number;
  parent_code: string | null;
  label: string;
  path: string;
  attachments?: OutlineAttachment[];
  children?: OutlineAtlasNode[];
  student_overlay?: StudentOutlineOverlay | null;
}

export interface OutlineAtlasResponse {
  nodes: OutlineAtlasNode[];
}

export interface OutlineAtlasNodeResponse {
  node: OutlineAtlasNode;
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: number | string | null | undefined): number {
  return numberOrNull(value) ?? 0;
}

function isoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function nodeFromRow(row: OutlineNodeRow): OutlineAtlasNode {
  const overlay =
    row.status === undefined
      ? undefined
      : {
          status: row.status ?? "untouched",
          mastery_score: numberOrNull(row.mastery_score),
          confidence: numberOrNull(row.confidence),
          attempts: numberOrZero(row.attempts),
          correct: numberOrZero(row.correct),
          accuracy: numberOrNull(row.accuracy),
          q_available: numberOrZero(row.q_available),
          last_attempt_at: isoOrNull(row.last_attempt_at),
          last_seen_at: isoOrNull(row.last_seen_at),
          dominant_trap: row.dominant_trap ?? null,
          dominant_red_zone_id: row.dominant_red_zone_id ?? null,
        };
  return {
    code: row.code,
    ab: row.ab,
    level: numberOrZero(row.level),
    parent_code: row.parent_code,
    label: row.label,
    path: row.path,
    ...(overlay ? { student_overlay: overlay } : {}),
  };
}

function attachmentFromRow(row: OutlineAttachmentRow): OutlineAttachment {
  return {
    attachment_type: row.attachment_type,
    attachment_id: row.attachment_id,
    role: row.role,
    status: row.status,
    sort_order: numberOrNull(row.sort_order),
  };
}

export async function readOutlineAtlas(
  db: Queryable,
  input: { studentId?: string; limit?: number } = {},
): Promise<OutlineAtlasResponse> {
  const limit = Math.min(Math.max(input.limit ?? 600, 1), 1000);
  if (input.studentId) {
    const { rows } = await db.query<OutlineNodeRow>(
      `SELECT n.code, n.ab, n.level, n.parent_code, n.label, n.path,
              COALESCE(p.status, 'untouched') AS status,
              p.mastery_score, p.confidence, COALESCE(p.attempts, 0) AS attempts,
              COALESCE(p.correct, 0) AS correct, p.accuracy,
              COALESCE(p.q_available, 0) AS q_available,
              p.last_attempt_at, p.last_seen_at, p.dominant_trap, p.dominant_red_zone_id
         FROM outline_nodes n
         LEFT JOIN student_outline_perf p
           ON p.outline_code = n.code
          AND p.student_id = $1
        ORDER BY n.ab ASC, n.code ASC
        LIMIT $2`,
      [input.studentId, limit],
    );
    return { nodes: rows.map(nodeFromRow) };
  }

  const { rows } = await db.query<OutlineNodeRow>(
    `SELECT code, ab, level, parent_code, label, path
       FROM outline_nodes
      ORDER BY ab ASC, code ASC
      LIMIT $1`,
    [limit],
  );
  return { nodes: rows.map(nodeFromRow) };
}

async function readOutlineNode(
  db: Queryable,
  input: { code: string; studentId?: string },
): Promise<OutlineAtlasNode | null> {
  if (input.studentId) {
    const { rows } = await db.query<OutlineNodeRow>(
      `SELECT n.code, n.ab, n.level, n.parent_code, n.label, n.path,
              COALESCE(p.status, 'untouched') AS status,
              p.mastery_score, p.confidence, COALESCE(p.attempts, 0) AS attempts,
              COALESCE(p.correct, 0) AS correct, p.accuracy,
              COALESCE(p.q_available, 0) AS q_available,
              p.last_attempt_at, p.last_seen_at, p.dominant_trap, p.dominant_red_zone_id
         FROM outline_nodes n
         LEFT JOIN student_outline_perf p
           ON p.outline_code = n.code
          AND p.student_id = $2
        WHERE n.code = $1
        LIMIT 1`,
      [input.code, input.studentId],
    );
    return rows[0] ? nodeFromRow(rows[0]) : null;
  }

  const { rows } = await db.query<OutlineNodeRow>(
    `SELECT code, ab, level, parent_code, label, path
       FROM outline_nodes
      WHERE code = $1
      LIMIT 1`,
    [input.code],
  );
  return rows[0] ? nodeFromRow(rows[0]) : null;
}

async function readOutlineAttachments(
  db: Queryable,
  code: string,
): Promise<OutlineAttachment[]> {
  const { rows } = await db.query<OutlineAttachmentRow>(
    `SELECT attachment_type, attachment_id, role, status, sort_order
       FROM outline_node_attachments
      WHERE outline_code = $1
        AND status IN ('active', 'published')
      ORDER BY COALESCE(sort_order, 999999), attachment_id ASC`,
    [code],
  );
  return rows.map(attachmentFromRow);
}

async function readOutlineChildren(
  db: Queryable,
  code: string,
  studentId?: string,
): Promise<OutlineAtlasNode[]> {
  if (studentId) {
    const { rows } = await db.query<OutlineNodeRow>(
      `SELECT DISTINCT n.code, n.ab, n.level, n.parent_code, n.label, n.path,
              COALESCE(p.status, 'untouched') AS status,
              p.mastery_score, p.confidence, COALESCE(p.attempts, 0) AS attempts,
              COALESCE(p.correct, 0) AS correct, p.accuracy,
              COALESCE(p.q_available, 0) AS q_available,
              p.last_attempt_at, p.last_seen_at, p.dominant_trap, p.dominant_red_zone_id
         FROM outline_nodes n
         LEFT JOIN outline_node_edges e
           ON e.child_code = n.code
          AND e.edge_type = 'parent_child'
         LEFT JOIN student_outline_perf p
           ON p.outline_code = n.code
          AND p.student_id = $2
        WHERE n.parent_code = $1 OR e.parent_code = $1
        ORDER BY n.code ASC`,
      [code, studentId],
    );
    return rows.map(nodeFromRow);
  }

  const { rows } = await db.query<OutlineNodeRow>(
    `SELECT DISTINCT n.code, n.ab, n.level, n.parent_code, n.label, n.path
       FROM outline_nodes n
       LEFT JOIN outline_node_edges e
         ON e.child_code = n.code
        AND e.edge_type = 'parent_child'
      WHERE n.parent_code = $1 OR e.parent_code = $1
      ORDER BY n.code ASC`,
    [code],
  );
  return rows.map(nodeFromRow);
}

export async function readOutlineAtlasNode(
  db: Queryable,
  input: { code: string; studentId?: string },
): Promise<OutlineAtlasNodeResponse | null> {
  const node = await readOutlineNode(db, input);
  if (!node) return null;
  const [attachments, children] = await Promise.all([
    readOutlineAttachments(db, input.code),
    readOutlineChildren(db, input.code, input.studentId),
  ]);
  return { node: { ...node, attachments, children } };
}

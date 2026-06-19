import { randomUUID } from "node:crypto";
import type { DbPool, QueryResult } from "../db.js";
import {
  catchupCandidatesForRollover,
  contentRefKey,
  type CatchupBankItem,
  type CatchupCandidate,
  type DayPlanManifest,
  type DayPlanStep,
  type DayPlanStepKind,
  type DayPlanStepSource,
} from "./day-plan.js";

type Queryable = Pick<DbPool, "query">;

const createProgressTableSql = `
CREATE TABLE IF NOT EXISTS student_day_plan_progress (
  progress_id       CHAR(36)      NOT NULL,
  student_id        CHAR(36)      NOT NULL,
  day_key           VARCHAR(16)   NOT NULL,
  step_id           VARCHAR(128)  NOT NULL,
  source            VARCHAR(16)   NOT NULL,
  main_item_id      VARCHAR(128),
  content_ref_type  VARCHAR(64),
  content_ref_id    VARCHAR(128),
  completed_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  metadata          JSON          NOT NULL,
  PRIMARY KEY (progress_id),
  UNIQUE KEY uq_day_plan_progress_step (student_id, day_key, source, step_id),
  KEY idx_day_plan_progress_student_day (student_id, day_key, source),
  KEY idx_day_plan_progress_student_completed (student_id, completed_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createCatchupTableSql = `
CREATE TABLE IF NOT EXISTS student_catchup_bank (
  catchup_id          CHAR(36)      NOT NULL,
  student_id          CHAR(36)      NOT NULL,
  original_day_key    VARCHAR(16)   NOT NULL,
  original_step_id    VARCHAR(128)  NOT NULL,
  main_item_id        VARCHAR(128)  NOT NULL,
  title               VARCHAR(255)  NOT NULL,
  prompt              TEXT          NOT NULL,
  kind                VARCHAR(64)   NOT NULL,
  content_ref_type    VARCHAR(64)   NOT NULL,
  content_ref_id      VARCHAR(128)  NOT NULL,
  content_ref_label   VARCHAR(255),
  content_ref_href    VARCHAR(512),
  action_label        VARCHAR(128)  NOT NULL,
  action_href         VARCHAR(512),
  xp                  INT           NOT NULL DEFAULT 0,
  status              VARCHAR(32)   NOT NULL DEFAULT 'pending',
  missed_at           DATETIME(6)   NOT NULL,
  completed_at        DATETIME(6),
  step_json           JSON          NOT NULL,
  PRIMARY KEY (catchup_id),
  UNIQUE KEY uq_catchup_original_step (student_id, original_day_key, original_step_id),
  KEY idx_catchup_student_status (student_id, status, missed_at),
  KEY idx_catchup_content_ref (student_id, status, content_ref_type, content_ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let schemaReady = false;

export async function ensureDayPlanTables(db: Queryable): Promise<void> {
  if (schemaReady) return;
  await db.query(createProgressTableSql);
  await db.query(createCatchupTableSql);
  schemaReady = true;
}

export async function readCompletedStepIds(
  db: Queryable,
  input: {
    studentId: string;
    dayKey: string;
    source: DayPlanStepSource;
  },
): Promise<Set<string>> {
  const { rows } = await db.query<{ step_id: string }>(
    `SELECT step_id
       FROM student_day_plan_progress
      WHERE student_id = $1 AND day_key = $2 AND source = $3`,
    [input.studentId, input.dayKey, input.source],
  );
  return new Set(rows.map((row) => row.step_id));
}

export async function readPendingCatchupBank(
  db: Queryable,
  studentId: string,
): Promise<CatchupBankItem[]> {
  const { rows } = await db.query<CatchupRow>(
    `SELECT catchup_id, student_id, original_day_key, original_step_id,
            main_item_id, title, prompt, kind, content_ref_type,
            content_ref_id, content_ref_label, content_ref_href,
            action_label, action_href, xp,
            DATE_FORMAT(missed_at, '%Y-%m-%dT%H:%i:%sZ') AS missed_at
       FROM student_catchup_bank
      WHERE student_id = $1 AND status = 'pending'
      ORDER BY original_day_key ASC, missed_at ASC, original_step_id ASC`,
    [studentId],
  );
  return rows.map(rowToCatchup);
}

export async function readCatchupById(
  db: Queryable,
  input: { studentId: string; catchupId: string },
): Promise<(CatchupBankItem & { status: string }) | null> {
  const { rows } = await db.query<CatchupRow & { status: string }>(
    `SELECT catchup_id, student_id, original_day_key, original_step_id,
            main_item_id, title, prompt, kind, content_ref_type,
            content_ref_id, content_ref_label, content_ref_href,
            action_label, action_href, xp, status,
            DATE_FORMAT(missed_at, '%Y-%m-%dT%H:%i:%sZ') AS missed_at
       FROM student_catchup_bank
      WHERE student_id = $1 AND catchup_id = $2
      LIMIT 1`,
    [input.studentId, input.catchupId],
  );
  const row = rows[0];
  return row ? { ...rowToCatchup(row), status: row.status } : null;
}

export async function readExistingCatchupContentRefs(
  db: Queryable,
  studentId: string,
): Promise<Set<string>> {
  const { rows } = await db.query<{ content_ref_type: string; content_ref_id: string }>(
    `SELECT content_ref_type, content_ref_id
       FROM student_catchup_bank
      WHERE student_id = $1 AND status = 'pending'`,
    [studentId],
  );
  return new Set(
    rows.map((row) => `${row.content_ref_type}:${row.content_ref_id}`),
  );
}

export async function readPriorDailyKeys(
  db: Queryable,
  input: { studentId: string; currentDayKey: string },
): Promise<string[]> {
  const { rows } = await db.query<{ day_key: string }>(
    `SELECT DISTINCT day_key
       FROM student_day_plan_progress
      WHERE student_id = $1
        AND source = 'daily'
        AND day_key < $2
      ORDER BY day_key ASC`,
    [input.studentId, input.currentDayKey],
  );
  return rows.map((row) => row.day_key);
}

export async function rolloverMissedDailySteps(
  db: Queryable,
  input: {
    studentId: string;
    originalDayKey: string;
    manifest: DayPlanManifest;
    now: Date;
  },
): Promise<number> {
  const [completedStepIds, existingCatchupContentRefs] = await Promise.all([
    readCompletedStepIds(db, {
      studentId: input.studentId,
      dayKey: input.originalDayKey,
      source: "daily",
    }),
    readExistingCatchupContentRefs(db, input.studentId),
  ]);
  const candidates = catchupCandidatesForRollover({
    manifest: input.manifest,
    originalDayKey: input.originalDayKey,
    completedStepIds,
    existingCatchupContentRefs,
    missedAt: input.now,
  });
  let inserted = 0;
  for (const candidate of candidates) {
    const result = await insertCatchupCandidate(db, input.studentId, candidate);
    inserted += result.rowCount === 1 ? 1 : 0;
  }
  return inserted;
}

export async function rolloverPriorDailySteps(
  db: Queryable,
  input: {
    studentId: string;
    currentDayKey: string;
    manifest: DayPlanManifest;
    now: Date;
  },
): Promise<number> {
  const dayKeys = await readPriorDailyKeys(db, {
    studentId: input.studentId,
    currentDayKey: input.currentDayKey,
  });
  let inserted = 0;
  for (const originalDayKey of dayKeys) {
    inserted += await rolloverMissedDailySteps(db, {
      studentId: input.studentId,
      originalDayKey,
      manifest: input.manifest,
      now: input.now,
    });
  }
  return inserted;
}

export async function recordDailyStepCompletion(
  db: Queryable,
  input: {
    studentId: string;
    dayKey: string;
    step: DayPlanStep;
  },
): Promise<boolean> {
  const result = await db.query(
    `INSERT IGNORE INTO student_day_plan_progress
       (progress_id, student_id, day_key, step_id, source, main_item_id,
        content_ref_type, content_ref_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      randomUUID(),
      input.studentId,
      input.dayKey,
      input.step.step_id,
      "daily",
      input.step.main_item_id,
      input.step.content_ref.type,
      input.step.content_ref.id,
      JSON.stringify({
        title: input.step.title,
        prompt: input.step.prompt,
        kind: input.step.kind,
        content_ref: input.step.content_ref,
        action: input.step.action,
        xp: input.step.xp,
      }),
    ],
  );
  return result.rowCount === 1;
}

export async function recordCatchupStepCompletion(
  db: Queryable,
  input: {
    studentId: string;
    dayKey: string;
    catchupId: string;
  },
): Promise<boolean> {
  const update = await db.query(
    `UPDATE student_catchup_bank
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP(6)
      WHERE student_id = $1
        AND catchup_id = $2
        AND status = 'pending'`,
    [input.studentId, input.catchupId],
  );
  if (update.rowCount === 0) return false;
  const result = await db.query(
    `INSERT IGNORE INTO student_day_plan_progress
       (progress_id, student_id, day_key, step_id, source, main_item_id,
        content_ref_type, content_ref_id, metadata)
     VALUES ($1, $2, $3, $4, $5, NULL, NULL, NULL, $6)`,
    [
      randomUUID(),
      input.studentId,
      input.dayKey,
      input.catchupId,
      "catchup",
      JSON.stringify({ catchup_id: input.catchupId }),
    ],
  );
  return result.rowCount === 1;
}

async function insertCatchupCandidate(
  db: Queryable,
  studentId: string,
  candidate: CatchupCandidate,
): Promise<QueryResult<unknown>> {
  return db.query(
    `INSERT IGNORE INTO student_catchup_bank
       (catchup_id, student_id, original_day_key, original_step_id,
        main_item_id, title, prompt, kind, content_ref_type, content_ref_id,
        content_ref_label, content_ref_href, action_label, action_href,
        xp, missed_at, step_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17)`,
    [
      randomUUID(),
      studentId,
      candidate.original_day_key,
      candidate.original_step_id,
      candidate.main_item_id,
      candidate.title,
      candidate.prompt,
      candidate.kind,
      candidate.content_ref.type,
      candidate.content_ref.id,
      candidate.content_ref.label ?? null,
      candidate.content_ref.href ?? null,
      candidate.action.label,
      candidate.action.href ?? null,
      candidate.xp,
      candidate.missed_at.slice(0, 19).replace("T", " "),
      JSON.stringify(candidate),
    ],
  );
}

interface CatchupRow {
  catchup_id: string;
  student_id: string;
  original_day_key: string;
  original_step_id: string;
  main_item_id: string;
  title: string;
  prompt: string;
  kind: string;
  content_ref_type: CatchupBankItem["content_ref"]["type"];
  content_ref_id: string;
  content_ref_label: string | null;
  content_ref_href: string | null;
  action_label: string;
  action_href: string | null;
  xp: number | string;
  missed_at: string;
}

function rowToCatchup(row: CatchupRow): CatchupBankItem {
  return {
    catchup_id: row.catchup_id,
    student_id: row.student_id,
    original_day_key: row.original_day_key,
    original_step_id: row.original_step_id,
    main_item_id: row.main_item_id,
    title: row.title,
    prompt: row.prompt,
    kind: row.kind as DayPlanStepKind,
    content_ref: {
      type: row.content_ref_type,
      id: row.content_ref_id,
      label: row.content_ref_label ?? undefined,
      href: row.content_ref_href ?? undefined,
    },
    action: {
      label: row.action_label,
      href: row.action_href ?? undefined,
    },
    xp: Number(row.xp),
    missed_at: row.missed_at,
  };
}

export function catchupContentRefKey(item: CatchupBankItem): string {
  return contentRefKey(item.content_ref);
}

import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

export const REQUIRED_V2_TABLES = [
  "leadme_items",
  "leadme_item_options",
  "leadme_item_evaluation",
  "leadme_item_tags",
  "leadme_compiled_payloads",
  "leadme_sets",
  "leadme_set_entries",
  "student_leadme_events",
  "leadme_served_snapshots",
  "leadme_submissions",
  "leadme_runtime_events",
  "student_leadme_queue",
  "outline_nodes",
  "student_outline_perf",
  "student_outline_events",
  "attempt_telemetry_ext",
  "attempt_choice_actions",
  "attempt_feedback",
  "student_debrief_events",
  "debriefs",
  "debrief_sections",
  "debrief_elements",
  "debrief_element_sources",
  "debrief_element_tags",
  "debrief_element_relations",
  "debrief_element_leadme_exports",
  "student_debrief_element_state",
  "debrief_element_stats",
  "student_red_zones",
  "student_tag_mastery",
  "student_confidence_calibration",
  "content_promotion_gates",
  "question_id_migration",
  "answer_choice_id_migration",
  "outline_node_edges",
  "outline_node_attachments",
] as const;

export const PROMOTION_GATE_STATUS_COLUMN = "gate_status";
export const REQUIRED_PROMOTION_GATES = [
  "schema_valid",
  "outline_code_valid",
  "signals_not_deltas",
  "christian_theming_audit",
  "no_answer_leakage",
  "doctrine_gate",
  "legal_review",
] as const;
export const STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES = ["active", "core"] as const;
export const REVIEWED_DEBRIEF_ELEMENT_STATUSES = [
  "approved",
  "reviewed",
  "legal_reviewed",
  "active",
] as const;
export const STARTABLE_LEADME_STATUSES = ["active", "published"] as const;
export const SERVABLE_QUEUE_STATUSES = ["available", "served", "viewed", "started"] as const;

type Env = Record<string, string | undefined>;

interface CountRow {
  row_count: number | string;
}

interface NamedCountRow {
  name: string;
  status: string;
  row_count: number | string;
}

interface ReleaseGateRow {
  item_id: string;
  external_id: string;
  version: string;
  content_hash: string | null;
  gate_name: string;
  status: string;
}

interface DebriefElementReleaseRow {
  element_id: string;
  status: string;
  review_status: string | null;
}

interface LeadMeSetReleaseRow {
  set_id: string;
  item_id: string | null;
  item_status: string | null;
  finding: string;
}

interface OutlineAttachmentReleaseRow {
  outline_code: string;
  attachment_type: string;
  attachment_id: string;
  target_status: string | null;
  target_review_status: string | null;
  finding: string;
}

interface LeadMeItemPayloadReleaseRow {
  item_id: string;
  version: string;
  content_hash: string | null;
  finding: string;
}

interface LeadMeQueueReleaseRow {
  queue_entry_id: string;
  student_id: string;
  item_id: string;
  item_version: string;
  content_hash: string | null;
  item_status: string | null;
  finding: string;
}

export function missingDbEnv(env: Env): string[] {
  const missing = ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER"].filter(
    (key) => !env[key],
  );
  if (!env.BARMATRIX_DB_KEY && !env.DATABASE_PASSWORD) {
    missing.push("BARMATRIX_DB_KEY or DATABASE_PASSWORD");
  }
  return missing;
}

export function missingNames(required: readonly string[], present: readonly string[]): string[] {
  const have = new Set(present);
  return required.filter((name) => !have.has(name));
}

export function formatPreflightError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return "LeadMe v2 DB preflight failed; check DB env and network reachability";
}

export function isInvokedPath(modulePath: string, argvPath: string | undefined): boolean {
  if (!argvPath) return false;
  const normalize = (path: string) => {
    try {
      return realpathSync(path).toLowerCase();
    } catch {
      return path.toLowerCase();
    }
  };
  return normalize(modulePath) === normalize(argvPath);
}

function loadEnv(): void {
  const candidates = [
    process.env.BARMATRIX_ENV_FILE,
    join(homedir(), "secrets", "barmatrix-api.env"),
    "/home/u211961595/secrets/barmatrix-api.env",
    join(process.cwd(), ".env"),
  ].filter((p): p is string => Boolean(p));
  const envPath = candidates.find((path) => existsSync(path));
  if (envPath) dotenv.config({ path: envPath });
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

async function countTable(
  pool: mysql.Pool,
  table: string,
): Promise<number | "missing"> {
  const [tables] = await pool.query<Array<{ table_name: string } & mysql.RowDataPacket>>(
    `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  if (tables.length === 0) return "missing";
  const [rows] = await pool.query<Array<CountRow & mysql.RowDataPacket>>(
    `SELECT COUNT(*) AS row_count FROM \`${table}\``,
  );
  return Number(rows[0]?.row_count ?? 0);
}

async function main(): Promise<number> {
  loadEnv();
  const missing = missingDbEnv(process.env);
  if (missing.length > 0) {
    console.error(`Missing DB env: ${missing.join(", ")}`);
    return 2;
  }

  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? "3306"),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.BARMATRIX_DB_KEY ?? process.env.DATABASE_PASSWORD,
    waitForConnections: true,
    connectionLimit: 2,
    timezone: "Z",
  });

  try {
    const [dbRows] = await pool.query<Array<{ db_name: string } & mysql.RowDataPacket>>(
      "SELECT DATABASE() AS db_name",
    );
    const [tableRows] = await pool.query<Array<{ table_name: string } & mysql.RowDataPacket>>(
      `SELECT TABLE_NAME AS table_name
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${placeholders(REQUIRED_V2_TABLES)})`,
      [...REQUIRED_V2_TABLES],
    );
    const presentTables = tableRows.map((row) => row.table_name);
    const missingTables = missingNames(REQUIRED_V2_TABLES, presentTables);

    const [columnRows] = await pool.query<Array<{ column_name: string } & mysql.RowDataPacket>>(
      `SELECT COLUMN_NAME AS column_name
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'student_attempts'
          AND COLUMN_NAME IN ('question_id', 'is_legacy', 'served_snapshot_id')`,
    );
    const attemptColumns = columnRows.map((row) => row.column_name);

    const [fkRows] = await pool.query<Array<{
      constraint_name: string;
      column_name: string;
      referenced_table_name: string;
      referenced_column_name: string;
    } & mysql.RowDataPacket>>(
      `SELECT CONSTRAINT_NAME AS constraint_name,
              COLUMN_NAME AS column_name,
              REFERENCED_TABLE_NAME AS referenced_table_name,
              REFERENCED_COLUMN_NAME AS referenced_column_name
         FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'student_attempts'
          AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY COLUMN_NAME, CONSTRAINT_NAME`,
    );

    let orphanCount: number | "skipped" = "skipped";
    if (attemptColumns.includes("question_id")) {
      const nonLegacyAttemptFilter = attemptColumns.includes("is_legacy")
        ? "AND COALESCE(a.is_legacy, 0) = 0"
        : "";
      const [rows] = await pool.query<Array<{ orphan_count: number | string } & mysql.RowDataPacket>>(
        `SELECT COUNT(*) AS orphan_count
           FROM student_attempts a
           LEFT JOIN questions q ON q.question_id = a.question_id
          WHERE a.question_id IS NOT NULL
            AND q.question_id IS NULL
            ${nonLegacyAttemptFilter}`,
      );
      orphanCount = Number(rows[0]?.orphan_count ?? 0);
    }

    const tableCounts = Object.fromEntries(
      await Promise.all(
        REQUIRED_V2_TABLES.map(async (table) => [table, await countTable(pool, table)] as const),
      ),
    );

    let gateCounts: NamedCountRow[] = [];
    let releaseGateFindings: ReleaseGateRow[] = [];
    let debriefElementReleaseFindings: DebriefElementReleaseRow[] = [];
    let leadMeSetReleaseFindings: LeadMeSetReleaseRow[] = [];
    let outlineAttachmentReleaseFindings: OutlineAttachmentReleaseRow[] = [];
    let leadMeItemPayloadReleaseFindings: LeadMeItemPayloadReleaseRow[] = [];
    let leadMeQueueReleaseFindings: LeadMeQueueReleaseRow[] = [];
    if (!missingTables.includes("content_promotion_gates")) {
      const [rows] = await pool.query<Array<NamedCountRow & mysql.RowDataPacket>>(
        `SELECT gate_name AS name, ${PROMOTION_GATE_STATUS_COLUMN} AS status, COUNT(*) AS row_count
           FROM content_promotion_gates
          GROUP BY gate_name, ${PROMOTION_GATE_STATUS_COLUMN}
          ORDER BY gate_name, ${PROMOTION_GATE_STATUS_COLUMN}`,
      );
      gateCounts = rows;
    }
    if (
      !missingTables.includes("content_promotion_gates") &&
      !missingTables.includes("leadme_items")
    ) {
      const gateSelect = REQUIRED_PROMOTION_GATES.map((_, index) =>
        index === 0 ? "SELECT ? AS gate_name" : "SELECT ?",
      ).join(" UNION ALL ");
      const [rows] = await pool.query<Array<ReleaseGateRow & mysql.RowDataPacket>>(
        `SELECT li.item_id AS item_id,
                li.external_id AS external_id,
                li.version AS version,
                li.content_hash AS content_hash,
                required_gates.gate_name AS gate_name,
                COALESCE(g.${PROMOTION_GATE_STATUS_COLUMN}, 'missing') AS status
           FROM leadme_items li
           JOIN (${gateSelect}) required_gates
          LEFT JOIN content_promotion_gates g
             ON g.object_id = li.item_id
            AND g.object_type = 'leadme_item'
            AND g.object_version = li.version
            AND g.content_hash = li.content_hash
            AND g.gate_name = required_gates.gate_name
          WHERE li.status IN (${placeholders(STARTABLE_LEADME_STATUSES)})
            AND COALESCE(g.${PROMOTION_GATE_STATUS_COLUMN}, 'missing') <> 'passed'
          ORDER BY li.item_id, required_gates.gate_name`,
        [...REQUIRED_PROMOTION_GATES, ...STARTABLE_LEADME_STATUSES],
      );
      releaseGateFindings = rows;
    }
    if (!missingTables.includes("debrief_elements")) {
      const [rows] = await pool.query<Array<DebriefElementReleaseRow & mysql.RowDataPacket>>(
        `SELECT element_id AS element_id,
                status AS status,
                review_status AS review_status
           FROM debrief_elements
          WHERE status IN (${placeholders(STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES)})
            AND (review_status IS NULL
              OR review_status NOT IN (${placeholders(REVIEWED_DEBRIEF_ELEMENT_STATUSES)}))
          ORDER BY element_id`,
        [
          ...STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES,
          ...REVIEWED_DEBRIEF_ELEMENT_STATUSES,
        ],
      );
      debriefElementReleaseFindings = rows;
    }
    if (
      !missingTables.includes("leadme_sets") &&
      !missingTables.includes("leadme_set_entries") &&
      !missingTables.includes("leadme_items")
    ) {
      const [rows] = await pool.query<Array<LeadMeSetReleaseRow & mysql.RowDataPacket>>(
        `SELECT s.set_id AS set_id,
                e.item_id AS item_id,
                i.status AS item_status,
                CASE
                  WHEN e.item_id IS NULL THEN 'set_has_no_entries'
                  WHEN i.item_id IS NULL THEN 'entry_item_missing'
                  ELSE 'entry_item_not_startable'
                END AS finding
           FROM leadme_sets s
           LEFT JOIN leadme_set_entries e ON e.set_id = s.set_id
           LEFT JOIN leadme_items i ON i.item_id = e.item_id
          WHERE s.status IN (${placeholders(STARTABLE_LEADME_STATUSES)})
            AND (e.item_id IS NULL
              OR i.item_id IS NULL
              OR i.status IS NULL
              OR i.status NOT IN (${placeholders(STARTABLE_LEADME_STATUSES)}))
          ORDER BY s.set_id, e.position, e.item_id`,
        [...STARTABLE_LEADME_STATUSES, ...STARTABLE_LEADME_STATUSES],
      );
      leadMeSetReleaseFindings = rows;
    }
    if (
      !missingTables.includes("leadme_items") &&
      !missingTables.includes("leadme_compiled_payloads")
    ) {
      const [rows] = await pool.query<Array<LeadMeItemPayloadReleaseRow & mysql.RowDataPacket>>(
        `SELECT li.item_id AS item_id,
                li.version AS version,
                li.content_hash AS content_hash,
                CASE
                  WHEN li.compiled_json_text IS NULL OR li.compiled_json_text = '' THEN 'missing_front_payload'
                  WHEN li.content_hash IS NULL OR li.content_hash = '' THEN 'missing_content_hash'
                  WHEN cp.item_id IS NULL THEN 'missing_server_payload'
                  WHEN cp.submit_private_json IS NULL OR cp.submit_private_json = '' THEN 'missing_submit_private'
                  WHEN cp.branch_private_json IS NULL OR cp.branch_private_json = '' THEN 'missing_branch_private'
                  WHEN cp.scoring_signal_json IS NULL OR cp.scoring_signal_json = '' THEN 'missing_scoring_signal'
                  WHEN cp.compiled_server_payload_hash IS NULL OR cp.compiled_server_payload_hash = '' THEN 'missing_server_payload_hash'
                  ELSE 'unknown_payload_gap'
                END AS finding
           FROM leadme_items li
           LEFT JOIN leadme_compiled_payloads cp
             ON cp.item_id = li.item_id
            AND cp.item_version = li.version
            AND cp.content_hash = li.content_hash
          WHERE li.status IN (${placeholders(STARTABLE_LEADME_STATUSES)})
            AND (
              li.compiled_json_text IS NULL
              OR li.compiled_json_text = ''
              OR li.content_hash IS NULL
              OR li.content_hash = ''
              OR cp.item_id IS NULL
              OR cp.submit_private_json IS NULL
              OR cp.submit_private_json = ''
              OR cp.branch_private_json IS NULL
              OR cp.branch_private_json = ''
              OR cp.scoring_signal_json IS NULL
              OR cp.scoring_signal_json = ''
              OR cp.compiled_server_payload_hash IS NULL
              OR cp.compiled_server_payload_hash = ''
            )
          ORDER BY li.item_id, li.version`,
        [...STARTABLE_LEADME_STATUSES],
      );
      leadMeItemPayloadReleaseFindings = rows;
    }
    if (
      !missingTables.includes("student_leadme_queue") &&
      !missingTables.includes("leadme_items")
    ) {
      const [rows] = await pool.query<Array<LeadMeQueueReleaseRow & mysql.RowDataPacket>>(
        `SELECT q.queue_entry_id AS queue_entry_id,
                q.student_id AS student_id,
                q.item_id AS item_id,
                q.item_version AS item_version,
                q.content_hash AS content_hash,
                i.status AS item_status,
                CASE
                  WHEN q.content_hash IS NULL OR q.content_hash = '' THEN 'queue_missing_content_hash'
                  WHEN i.item_id IS NULL THEN 'queue_item_missing'
                  ELSE 'queue_item_not_startable'
                END AS finding
           FROM student_leadme_queue q
           LEFT JOIN leadme_items i
             ON i.item_id = q.item_id
            AND i.version = q.item_version
            AND i.content_hash = q.content_hash
          WHERE q.status IN (${placeholders(SERVABLE_QUEUE_STATUSES)})
            AND (
              q.content_hash IS NULL
              OR q.content_hash = ''
              OR i.item_id IS NULL
              OR i.status IS NULL
              OR i.status NOT IN (${placeholders(STARTABLE_LEADME_STATUSES)})
            )
          ORDER BY q.student_id, q.queue_entry_id`,
        [...SERVABLE_QUEUE_STATUSES, ...STARTABLE_LEADME_STATUSES],
      );
      leadMeQueueReleaseFindings = rows;
    }
    if (
      !missingTables.includes("outline_node_attachments") &&
      !missingTables.includes("leadme_items") &&
      !missingTables.includes("debrief_elements")
    ) {
      const [rows] = await pool.query<Array<OutlineAttachmentReleaseRow & mysql.RowDataPacket>>(
        `SELECT a.outline_code AS outline_code,
                a.attachment_type AS attachment_type,
                a.attachment_id AS attachment_id,
                COALESCE(li.status, de.status) AS target_status,
                de.review_status AS target_review_status,
                CASE
                  WHEN a.attachment_type = 'leadme_item' AND li.item_id IS NULL THEN 'leadme_item_missing'
                  WHEN a.attachment_type = 'leadme_item' THEN 'leadme_item_not_startable'
                  WHEN a.attachment_type = 'debrief_element' AND de.element_id IS NULL THEN 'debrief_element_missing'
                  WHEN a.attachment_type = 'debrief_element' THEN 'debrief_element_not_student_safe'
                  ELSE 'unsupported_attachment_type'
                END AS finding
           FROM outline_node_attachments a
           LEFT JOIN leadme_items li
             ON a.attachment_type = 'leadme_item'
            AND li.item_id = a.attachment_id
           LEFT JOIN debrief_elements de
             ON a.attachment_type = 'debrief_element'
            AND de.element_id = a.attachment_id
          WHERE a.status IN (${placeholders(STARTABLE_LEADME_STATUSES)})
            AND (
              (a.attachment_type = 'leadme_item'
                AND (li.item_id IS NULL
                  OR li.status IS NULL
                  OR li.status NOT IN (${placeholders(STARTABLE_LEADME_STATUSES)})))
              OR (a.attachment_type = 'debrief_element'
                AND (de.element_id IS NULL
                  OR de.status IS NULL
                  OR de.status NOT IN (${placeholders(STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES)})
                  OR de.review_status IS NULL
                  OR de.review_status NOT IN (${placeholders(REVIEWED_DEBRIEF_ELEMENT_STATUSES)})))
              OR a.attachment_type NOT IN ('leadme_item', 'debrief_element')
            )
          ORDER BY a.outline_code, a.attachment_type, a.attachment_id`,
        [
          ...STARTABLE_LEADME_STATUSES,
          ...STARTABLE_LEADME_STATUSES,
          ...STUDENT_SAFE_DEBRIEF_ELEMENT_STATUSES,
          ...REVIEWED_DEBRIEF_ELEMENT_STATUSES,
        ],
      );
      outlineAttachmentReleaseFindings = rows;
    }

    console.log(JSON.stringify({
      database: dbRows[0]?.db_name ?? null,
      missing_v2_tables: missingTables,
      student_attempts_columns: attemptColumns,
      student_attempts_foreign_keys: fkRows,
      student_attempts_question_orphans: orphanCount,
      table_counts: tableCounts,
      promotion_gate_counts: gateCounts,
      promotion_gate_release_findings: releaseGateFindings,
      debrief_element_release_findings: debriefElementReleaseFindings,
      leadme_set_release_findings: leadMeSetReleaseFindings,
      leadme_item_payload_release_findings: leadMeItemPayloadReleaseFindings,
      leadme_queue_release_findings: leadMeQueueReleaseFindings,
      outline_attachment_release_findings: outlineAttachmentReleaseFindings,
    }, null, 2));

    return missingTables.length === 0 &&
      releaseGateFindings.length === 0 &&
      debriefElementReleaseFindings.length === 0 &&
      leadMeSetReleaseFindings.length === 0 &&
      leadMeItemPayloadReleaseFindings.length === 0 &&
      leadMeQueueReleaseFindings.length === 0 &&
      outlineAttachmentReleaseFindings.length === 0
      ? 0
      : 1;
  } finally {
    await pool.end();
  }
}

const invokedPath = isInvokedPath(fileURLToPath(import.meta.url), process.argv[1]);
if (invokedPath) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      console.error(formatPreflightError(err));
      process.exit(1);
    });
}

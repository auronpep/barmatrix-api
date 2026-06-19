import mysql, { type RowDataPacket } from "mysql2/promise";

export function remapQuestionIdArray(
  value: unknown,
  idMap: ReadonlyMap<string, string>,
): string[] {
  if (!Array.isArray(value)) return [];

  const remapped: string[] = [];
  for (const id of value) {
    if (typeof id !== "string") continue;
    const next = idMap.get(id);
    if (next) remapped.push(next);
  }
  return remapped;
}

export function remapDayQuestionIds(
  value: unknown,
  idMap: ReadonlyMap<string, string>,
): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const remapped: Record<string, string[]> = {};
  for (const [day, ids] of Object.entries(value)) {
    remapped[day] = remapQuestionIdArray(ids, idMap);
  }
  return remapped;
}

function parseJsonValue(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function loadQuestionIdMap(
  connection: mysql.Connection,
): Promise<Map<string, string>> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT old_question_id, new_question_id FROM question_id_migration WHERE new_question_id IS NOT NULL",
  );
  return new Map(
    rows.map((row) => [String(row.old_question_id), String(row.new_question_id)]),
  );
}

async function remapDrillAssignments(
  connection: mysql.Connection,
  idMap: ReadonlyMap<string, string>,
): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT assignment_id, question_ids FROM drill_assignments",
  );

  let updated = 0;
  for (const row of rows) {
    const assignmentId = String(row.assignment_id);
    const before = parseJsonValue(row.question_ids);
    const after = remapQuestionIdArray(before, idMap);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    await connection.query(
      "UPDATE drill_assignments SET question_ids = ? WHERE assignment_id = ?",
      [JSON.stringify(after), assignmentId],
    );
    updated += 1;
  }
  return updated;
}

async function remapBootCampSessions(
  connection: mysql.Connection,
  idMap: ReadonlyMap<string, string>,
): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT session_id, day_question_ids, mastery_question_ids FROM boot_camp_sessions",
  );

  let updated = 0;
  for (const row of rows) {
    const sessionId = String(row.session_id);
    const beforeDayIds = parseJsonValue(row.day_question_ids);
    const beforeMasteryIds = parseJsonValue(row.mastery_question_ids);
    const afterDayIds = remapDayQuestionIds(beforeDayIds, idMap);
    const afterMasteryIds = remapQuestionIdArray(beforeMasteryIds, idMap);

    if (
      JSON.stringify(beforeDayIds) === JSON.stringify(afterDayIds) &&
      JSON.stringify(beforeMasteryIds) === JSON.stringify(afterMasteryIds)
    ) {
      continue;
    }

    // ponytail: keep empty arrays; runtime serving rules decide stale handling.
    await connection.query(
      "UPDATE boot_camp_sessions SET day_question_ids = ?, mastery_question_ids = ? WHERE session_id = ?",
      [JSON.stringify(afterDayIds), JSON.stringify(afterMasteryIds), sessionId],
    );
    updated += 1;
  }
  return updated;
}

export async function runRemapJsonFksFromEnv(): Promise<{
  drillAssignments: number;
  bootCampSessions: number;
}> {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD ?? process.env.BARMATRIX_DB_KEY,
    database: process.env.DATABASE_NAME,
    timezone: "Z",
  });

  try {
    const idMap = await loadQuestionIdMap(connection);
    return {
      drillAssignments: await remapDrillAssignments(connection, idMap),
      bootCampSessions: await remapBootCampSessions(connection, idMap),
    };
  } finally {
    await connection.end();
  }
}

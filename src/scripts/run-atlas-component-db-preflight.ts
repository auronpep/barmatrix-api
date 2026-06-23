import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

import {
  formatPreflightError,
  isInvokedPath,
  missingDbEnv,
} from "./leadme-v2-db-preflight.js";

const DEFAULT_IMPORT_DIR = "C:/barmatrix-api/tasks/atlas-component-import-2026-06-21";
const PREFLIGHT_SQL_FILE = "PREFLIGHT_ATLAS_COMPONENT_IMPORT.sql";
const RESULT_FILE = "DB_PREFLIGHT_RESULT.json";

export function isReadOnlySql(sql: string): boolean {
  const withoutLineComments = sql.replace(/--.*$/gm, "");
  return !/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|REPLACE)\b/i.test(withoutLineComments);
}

export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function loadEnv(): void {
  const candidates = [
    process.env.BARMATRIX_ENV_FILE,
    join(homedir(), "secrets", "barmatrix-api.env"),
    "/home/u211961595/secrets/barmatrix-api.env",
    join(process.cwd(), ".env"),
  ].filter((p): p is string => Boolean(p));
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (envPath) dotenv.config({ path: envPath });
}

function writeResult(outDir: string, result: Record<string, unknown>) {
  writeFileSync(path.join(outDir, RESULT_FILE), JSON.stringify(result, null, 2));
}

function rowsArray(rows: unknown): Record<string, unknown>[] {
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function passedChecks(results: Array<{ rows: Record<string, unknown>[] }>): boolean {
  const tableCount = results[0]?.rows[0];
  const missingColumns = results[1]?.rows ?? [];
  const codeCount = results[2]?.rows[0];
  const missingCodes = results[3]?.rows ?? [];
  return (
    Number(tableCount?.found) === Number(tableCount?.expected) &&
    missingColumns.length === 0 &&
    Number(codeCount?.found) === Number(codeCount?.expected) &&
    missingCodes.length === 0
  );
}

export async function runAtlasComponentDbPreflight(outDir = DEFAULT_IMPORT_DIR): Promise<number> {
  loadEnv();
  const missing = missingDbEnv(process.env);
  if (missing.length > 0) {
    writeResult(outDir, {
      status: "not_run",
      reason: "missing_db_env",
      missing_db_env: missing,
    });
    console.error(`Missing DB env: ${missing.join(", ")}`);
    return 2;
  }

  const sqlPath = path.join(outDir, PREFLIGHT_SQL_FILE);
  const sql = readFileSync(sqlPath, "utf8");
  if (!isReadOnlySql(sql)) {
    throw new Error(`${PREFLIGHT_SQL_FILE} contains mutating SQL`);
  }

  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? "3306"),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.BARMATRIX_DB_KEY ?? process.env.DATABASE_PASSWORD,
    waitForConnections: true,
    connectionLimit: 1,
    timezone: "Z",
  });

  try {
    const [dbRows] = await pool.query<Array<{ db_name: string } & mysql.RowDataPacket>>(
      "SELECT DATABASE() AS db_name",
    );
    const results = [];
    for (const [index, statement] of splitSqlStatements(sql).entries()) {
      const [rows] = await pool.query(statement);
      results.push({
        statement_index: index + 1,
        row_count: rowsArray(rows).length,
        rows: rowsArray(rows),
      });
    }
    const status = passedChecks(results) ? "pass" : "fail";
    writeResult(outDir, {
      status,
      database: dbRows[0]?.db_name ?? null,
      statements: results,
    });
    console.log(JSON.stringify({ status, database: dbRows[0]?.db_name ?? null }, null, 2));
    return status === "pass" ? 0 : 1;
  } finally {
    await pool.end();
  }
}

const invokedPath = isInvokedPath(fileURLToPath(import.meta.url), process.argv[1]);
if (invokedPath) {
  runAtlasComponentDbPreflight(process.argv[2] ?? DEFAULT_IMPORT_DIR)
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      console.error(formatPreflightError(err));
      process.exit(1);
    });
}

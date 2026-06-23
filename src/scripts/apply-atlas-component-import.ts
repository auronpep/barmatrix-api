import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path, { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

import { isInvokedPath, missingDbEnv } from "./leadme-v2-db-preflight.js";
import { runAtlasComponentDbPreflight } from "./run-atlas-component-db-preflight.js";
import { verifyAtlasComponentImport } from "./verify-atlas-component-import.js";

const DEFAULT_IMPORT_DIR = "C:/barmatrix-api/tasks/atlas-component-import-2026-06-21";
const UNBLOCKED_SQL_FILE = "LOAD_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql";
const PROMOTION_SQL_FILE = "PROMOTE_ATLAS_COMPONENT_CANDIDATES_UNBLOCKED.sql";
const RESULT_FILE = "DB_IMPORT_RESULT.json";
type ApplyPhase = "candidate" | "promotion";

export interface ApplyAtlasComponentImportArgs {
  apply: boolean;
  importDir: string;
  phase: ApplyPhase;
}

export function parseArgs(argv: readonly string[]): ApplyAtlasComponentImportArgs {
  const args: ApplyAtlasComponentImportArgs = {
    apply: false,
    importDir: DEFAULT_IMPORT_DIR,
    phase: "candidate",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--import-dir") {
      const next = argv[i + 1];
      if (!next) throw new Error("--import-dir requires a path");
      args.importDir = resolve(next);
      i += 1;
    } else if (arg === "--phase") {
      const next = argv[i + 1];
      if (next !== "candidate" && next !== "promotion") {
        throw new Error("--phase requires candidate or promotion");
      }
      args.phase = next;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

export function resolveImportSqlFile(importDir: string, phase: ApplyPhase = "candidate"): string {
  return path.join(importDir, phase === "promotion" ? PROMOTION_SQL_FILE : UNBLOCKED_SQL_FILE);
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

function writeResult(importDir: string, result: Record<string, unknown>) {
  writeFileSync(path.join(importDir, RESULT_FILE), JSON.stringify(result, null, 2));
}

function assertPackageReady(importDir: string, phase: ApplyPhase): string {
  const report = verifyAtlasComponentImport(importDir);
  if (report.package_status !== "pass") {
    throw new Error("Atlas component import package is not promotion-ready");
  }
  const sqlFile = resolveImportSqlFile(importDir, phase);
  if (!existsSync(sqlFile)) throw new Error(`${path.basename(sqlFile)} is missing`);
  return sqlFile;
}

async function applySql(sqlFile: string): Promise<void> {
  loadEnv();
  const missing = missingDbEnv(process.env);
  if (missing.length > 0) throw new Error(`Missing DB env: ${missing.join(", ")}`);

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? "3306"),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.BARMATRIX_DB_KEY ?? process.env.DATABASE_PASSWORD,
    timezone: "Z",
    multipleStatements: true,
  });
  try {
    await connection.query(readFileSync(sqlFile, "utf8"));
  } finally {
    await connection.end();
  }
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  const sqlFile = assertPackageReady(args.importDir, args.phase);
  const output = {
    mode: args.apply ? "apply" : "dry-run",
    phase: args.phase,
    import_dir: args.importDir,
    sql_file: sqlFile,
    preflight: "required-before-apply",
    skipped:
      args.phase === "promotion"
        ? ["blocked human-review rows", "full candidate SQL", "candidate import rerun"]
        : ["blocked human-review rows", "full candidate SQL", "student-visible promotion"],
  };
  console.log(JSON.stringify(output, null, 2));

  if (!args.apply) return 0;
  const preflightCode = await runAtlasComponentDbPreflight(args.importDir);
  if (preflightCode !== 0) {
    writeResult(args.importDir, { status: "not_applied", reason: "preflight_failed" });
    return preflightCode;
  }
  await applySql(sqlFile);
  writeResult(args.importDir, { status: "applied", phase: args.phase, sql_file: sqlFile });
  return 0;
}

const invokedPath = isInvokedPath(fileURLToPath(import.meta.url), process.argv[1]);
if (invokedPath) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}

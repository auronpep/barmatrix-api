import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

import { missingDbEnv } from "./leadme-v2-db-preflight.js";

const ATLAS_V1_SQL_FILES = [
  "BARMATRIX/engineering/ATLAS_V1_CORE_LOAD.sql",
  "BARMATRIX/engineering/ATLAS_V1_QUESTION_LOAD.sql",
] as const;

export interface ApplyAtlasV1Args {
  apply: boolean;
  sqlRoot: string;
}

function defaultSqlRoot(cwd: string): string {
  const fallback = resolve(cwd, "..", "BMO");
  const candidates = [fallback, resolve(cwd, "..")];
  return candidates.find((candidate) =>
    existsSync(join(candidate, "BARMATRIX", "engineering")),
  ) ?? fallback;
}

export function parseArgs(argv: readonly string[], cwd = process.cwd()): ApplyAtlasV1Args {
  const args: ApplyAtlasV1Args = {
    apply: false,
    sqlRoot: defaultSqlRoot(cwd),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--sql-root") {
      const next = argv[i + 1];
      if (!next) throw new Error("--sql-root requires a path");
      args.sqlRoot = resolve(next);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

export function resolveSqlFiles(sqlRoot: string): string[] {
  return ATLAS_V1_SQL_FILES.map((file) => join(sqlRoot, file));
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
  ].filter((path): path is string => Boolean(path));
  const envPath = candidates.find((path) => existsSync(path));
  if (envPath) dotenv.config({ path: envPath });
}

async function applySql(files: readonly string[]): Promise<void> {
  loadEnv();
  const missing = missingDbEnv(process.env);
  if (missing.length > 0) {
    throw new Error(`Missing DB env: ${missing.join(", ")}`);
  }

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
    for (const file of files) {
      const sql = readFileSync(file, "utf8");
      await connection.query(sql);
      console.log(`applied ${file}`);
    }
  } finally {
    await connection.end();
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const files = resolveSqlFiles(args.sqlRoot);
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    console.error(`Missing SQL files:\n${missing.join("\n")}`);
    return 1;
  }

  console.log(JSON.stringify({
    mode: args.apply ? "apply" : "dry-run",
    files,
    skipped: [
      "Existing site content",
      "Legacy questions table",
      "Student outline performance",
      "Future inactive Atlas_v1 lanes",
    ],
  }, null, 2));

  if (!args.apply) return 0;
  await applySql(files);
  return 0;
}

const invokedPath = isInvokedPath(fileURLToPath(import.meta.url), process.argv[1]);
if (invokedPath) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}

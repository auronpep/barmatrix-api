#!/usr/bin/env node
// Apply the Hostinger MySQL schema against the configured database.
// Usage: npm run migrate

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const SCHEMA_PATHS = [
  process.env.SCHEMA_PATH ?? "",
  path.resolve("../BMO/BARMATRIX/engineering/SCHEMA_MYSQL.sql"),
  path.resolve("../../BMO/BARMATRIX/engineering/SCHEMA_MYSQL.sql"),
].filter(Boolean);

async function findSchema() {
  for (const p of SCHEMA_PATHS) {
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) return p;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    "Could not locate SCHEMA_MYSQL.sql. Set SCHEMA_PATH or run from the expected BMO/api-repo layout.",
  );
}

async function main() {
  const schemaPath = await findSchema();
  const sql = (await fs.readFile(schemaPath, "utf8")).replaceAll(
    "utf8mb4_0900_ai_ci",
    "utf8mb4_unicode_ci",
  );

  const databasePassword = process.env.DATABASE_PASSWORD || process.env.BARMATRIX_DB_KEY;
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: databasePassword,
    database: process.env.DATABASE_NAME,
    multipleStatements: true,
    timezone: "Z",
  });

  try {
    console.log(`Applying ${schemaPath} ...`);
    await connection.query(sql);
    console.log("Schema applied.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

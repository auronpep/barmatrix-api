#!/usr/bin/env node
// Apply BARMATRIX/engineering/SCHEMA_MYSQL.sql against the configured MySQL.
// Usage: npm run migrate
// Reads from ../BMO/BARMATRIX/engineering/SCHEMA_MYSQL.sql when run from C:\barmatrix-api.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const SCHEMA_PATHS = [
  // Relative to barmatrix-api root when run as a sibling of C:\BMO
  path.resolve("../BMO/BARMATRIX/engineering/SCHEMA_MYSQL.sql"),
  // Allow override via env
  process.env.SCHEMA_PATH ?? "",
].filter(Boolean);

async function findSchema() {
  for (const p of SCHEMA_PATHS) {
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) return p;
    } catch {
      // not found, try next
    }
  }
  throw new Error(
    `Could not locate SCHEMA_MYSQL.sql. Set SCHEMA_PATH env var or place this repo as a sibling of BMO.`,
  );
}

async function main() {
  const schemaPath = await findSchema();
  const sql = await fs.readFile(schemaPath, "utf8");

  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    multipleStatements: true,
  });

  try {
    console.log(`Applying ${schemaPath} ...`);
    await conn.query(sql);
    console.log("Schema applied.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

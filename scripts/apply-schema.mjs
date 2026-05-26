#!/usr/bin/env node
// Apply BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql against the configured
// Postgres. Usage: npm run migrate
//
// Locally: run the Cloud SQL Auth Proxy first so DATABASE_HOST=127.0.0.1
// reaches Cloud SQL, OR connect to a local Postgres seeded the same way.
// On Cloud Run we typically apply schemas via `gcloud sql connect` instead
// of via this script.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const SCHEMA_PATHS = [
  path.resolve("../BMO/BARMATRIX/engineering/SCHEMA_ONE_COHORT.sql"),
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
    `Could not locate SCHEMA_ONE_COHORT.sql. Set SCHEMA_PATH env var or place this repo as a sibling of BMO.`,
  );
}

async function main() {
  const schemaPath = await findSchema();
  const sql = await fs.readFile(schemaPath, "utf8");

  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  await client.connect();
  try {
    console.log(`Applying ${schemaPath} ...`);
    await client.query(sql);
    console.log("Schema applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

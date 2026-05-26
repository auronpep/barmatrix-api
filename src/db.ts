// Postgres connection pool. On Cloud Run we connect to Cloud SQL via the
// Unix socket mounted at /cloudsql/<INSTANCE_CONNECTION_NAME>; locally we
// connect over TCP. Lazy-initialized so the server can boot even when the
// database is briefly unavailable — first query surfaces the error.

import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;

  const isCloudRun = process.env.K_SERVICE !== undefined;

  pool = new Pool(
    isCloudRun
      ? {
          host: `/cloudsql/${config.db.instanceConnectionName}`,
          database: config.db.database,
          user: config.db.user,
          password: config.db.password,
          max: 10,
        }
      : {
          host: config.db.host,
          port: config.db.port,
          database: config.db.database,
          user: config.db.user,
          password: config.db.password,
          max: 10,
        },
  );

  return pool;
}

export async function ping(): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}

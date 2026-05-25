// MySQL connection pool. Lazy-initialized so the server can boot even when
// MySQL is briefly unavailable; first query attempt will surface the error.

import mysql, { type Pool, type PoolOptions } from "mysql2/promise";
import { config } from "./config.js";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const options: PoolOptions = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z", // store and read everything in UTC
    decimalNumbers: true,
    dateStrings: false,
    multipleStatements: false,
    namedPlaceholders: true,
  };

  pool = mysql.createPool(options);
  return pool;
}

export async function ping(): Promise<boolean> {
  const conn = await getPool().getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

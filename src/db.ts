// MySQL connection pool for the Hostinger runtime. The wrapper intentionally
// returns a pg-like { rows, rowCount } shape so route code can stay focused on
// domain behavior while the backing database moves from Postgres to MySQL.

import mysql, {
  type Pool as MysqlPool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { config } from "./config.js";

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = RowDataPacket>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
}

export interface DbPool {
  query<T = RowDataPacket>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  connect(): Promise<DbClient>;
  end(): Promise<void>;
}

let pool: DbPool | null = null;

export function toMysqlQuery(
  sql: string,
  values: readonly unknown[] = [],
): { sql: string; values: unknown[] } {
  const orderedValues: unknown[] = [];
  const convertedSql = sql.replace(/\$(\d+)/g, (_match, indexText: string) => {
    const index = Number(indexText) - 1;
    orderedValues.push(values[index]);
    return "?";
  });
  return { sql: convertedSql, values: orderedValues };
}

type MysqlExecutionMethod = "query";

export function toMysqlExecutionPlan(
  sql: string,
  values: readonly unknown[] = [],
): { sql: string; values: unknown[]; method: MysqlExecutionMethod } {
  const converted = toMysqlQuery(sql, values);
  return {
    ...converted,
    method: "query",
  };
}

export function getPool(): DbPool {
  if (pool) return pool;

  const mysqlPool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "Z",
    namedPlaceholders: false,
  });

  pool = {
    query: <T = RowDataPacket>(
      sql: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<T>> => queryMysql(mysqlPool, sql, values),
    connect: async (): Promise<DbClient> => {
      const connection = await mysqlPool.getConnection();
      return {
        query: <T = RowDataPacket>(
          sql: string,
          values?: readonly unknown[],
        ): Promise<QueryResult<T>> => queryMysql(connection, sql, values),
        release: () => connection.release(),
      };
    },
    end: () => mysqlPool.end(),
  };

  return pool;
}

async function queryMysql<T>(
  executor: MysqlPool | PoolConnection,
  sql: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  const plan = toMysqlExecutionPlan(sql, values);
  const [result] = await executor.query(plan.sql, plan.values as never[]);

  if (Array.isArray(result)) {
    return {
      rows: result as T[],
      rowCount: result.length,
    };
  }

  const header = result as ResultSetHeader;
  return {
    rows: [],
    rowCount: header.affectedRows ?? 0,
  };
}

export async function ping(): Promise<boolean> {
  await getPool().query("SELECT 1");
  return true;
}

import type { DbClient, DbPool, QueryResult } from "../db.js";

type Queryable = Pick<DbPool, "query">;

export interface CheckoutCapacityStatus {
  cohortId: string;
  internalCapacity: number;
  activeCount: number;
  isFull: boolean;
}

export class CohortCapacityUnavailableError extends Error {
  readonly code = "cohort_capacity_unavailable";

  constructor(message = "cohort capacity unavailable") {
    super(message);
    this.name = "CohortCapacityUnavailableError";
  }
}

export class CohortCapacityFullError extends Error {
  readonly code = "cohort_full";

  constructor(message = "cohort capacity reached") {
    super(message);
    this.name = "CohortCapacityFullError";
  }
}

export async function getCheckoutCapacityStatus(
  db: Queryable,
  cohortCode: string,
): Promise<CheckoutCapacityStatus> {
  let result: QueryResult<{
    cohort_id: string;
    internal_capacity: number | string;
    active_count: number | string;
  }>;
  try {
    result = await db.query(
      `SELECT c.cohort_id,
              c.internal_capacity,
              COALESCE(COUNT(e.enrollment_id), 0) AS active_count
         FROM cohort_config c
         LEFT JOIN cohort_enrollments e
           ON e.cohort_id = c.cohort_id
          AND e.enrollment_status = 'active'
        WHERE c.cohort_code = $1 AND c.active = 1
        GROUP BY c.cohort_id, c.internal_capacity`,
      [cohortCode],
    );
  } catch (err) {
    throw new CohortCapacityUnavailableError(
      `capacity lookup failed: ${summarizeCapacityError(err)}`,
    );
  }

  const row = result.rows[0];
  if (!row) {
    throw new CohortCapacityUnavailableError(
      `no active cohort_config row for cohort_code=${cohortCode}`,
    );
  }

  const internalCapacity = toNonNegativeInteger(row.internal_capacity);
  const activeCount = toNonNegativeInteger(row.active_count);
  return {
    cohortId: row.cohort_id,
    internalCapacity,
    activeCount,
    isFull: activeCount >= internalCapacity,
  };
}

export async function enforceCheckoutCapacityOpen(
  db: Queryable,
  cohortCode: string,
): Promise<CheckoutCapacityStatus> {
  const status = await getCheckoutCapacityStatus(db, cohortCode);
  if (status.isFull) {
    throw new CohortCapacityFullError(
      `cohort ${cohortCode} is at internal capacity`,
    );
  }
  return status;
}

export async function assignSeatWithinCapacity(
  client: DbClient,
  cohortId: string,
  studentId: string,
): Promise<number> {
  const cohort = await client.query<{ internal_capacity: number | string }>(
    `SELECT internal_capacity
       FROM cohort_config
      WHERE cohort_id = $1 AND active = 1
      FOR UPDATE`,
    [cohortId],
  );
  const cohortRow = cohort.rows[0];
  if (!cohortRow) {
    throw new CohortCapacityUnavailableError(
      `no active cohort_config row for cohort_id=${cohortId}`,
    );
  }
  const internalCapacity = toNonNegativeInteger(cohortRow.internal_capacity);

  const existing = await client.query<{
    seat_number: number | string | null;
    enrollment_status: string;
  }>(
    `SELECT seat_number, enrollment_status
       FROM cohort_enrollments
      WHERE cohort_id = $1 AND student_id = $2
      LIMIT 1`,
    [cohortId, studentId],
  );
  const existingRow = existing.rows[0];
  // Case 1: Already enrolled and active with an assigned seat — reuse it (idempotent)
  if (
    existingRow &&
    existingRow.enrollment_status === "active" &&
    existingRow.seat_number !== null
  ) {
    await client.query(
      `UPDATE cohort_enrollments
          SET enrollment_status = 'active'
        WHERE cohort_id = $1 AND student_id = $2`,
      [cohortId, studentId],
    );
    return toNonNegativeInteger(existingRow.seat_number);
  }

  const count = await client.query<{ active_count: number | string }>(
    `SELECT COALESCE(COUNT(enrollment_id), 0) AS active_count
       FROM cohort_enrollments
      WHERE cohort_id = $1 AND enrollment_status = 'active'`,
    [cohortId],
  );
  const activeCount = toNonNegativeInteger(count.rows[0]?.active_count ?? 0);
  if (activeCount >= internalCapacity) {
    throw new CohortCapacityFullError(
      `cohort ${cohortId} is at internal capacity`,
    );
  }

  // Case 2: Enrollment exists but either inactive or without a seat — reactivate and reuse
  if (existingRow?.seat_number !== null && existingRow?.seat_number !== undefined) {
    await client.query(
      `UPDATE cohort_enrollments
          SET enrollment_status = 'active'
        WHERE cohort_id = $1 AND student_id = $2`,
      [cohortId, studentId],
    );
    return toNonNegativeInteger(existingRow.seat_number);
  }

  const seatNumber = await nextSeatNumber(client, cohortId);
  // Case 3: Enrollment exists but without a seat — assign new seat and activate
  if (existingRow) {
    await client.query(
      `UPDATE cohort_enrollments
          SET seat_number = $3,
              enrollment_status = 'active'
        WHERE cohort_id = $1 AND student_id = $2`,
      [cohortId, studentId, seatNumber],
    );
    return seatNumber;
  }

  // Case 4: No enrollment exists — create new enrollment with new seat
  await client.query(
    `INSERT INTO cohort_enrollments (
       enrollment_id, cohort_id, student_id, seat_number, enrollment_status
     )
     VALUES (UUID(), $1, $2, $3, 'active')`,
    [cohortId, studentId, seatNumber],
  );
  return seatNumber;
}

async function nextSeatNumber(
  client: DbClient,
  cohortId: string,
): Promise<number> {
  const result = await client.query<{ seat_number: number | string }>(
    `SELECT COALESCE(MAX(seat_number), 0) + 1 AS seat_number
       FROM cohort_enrollments
      WHERE cohort_id = $1`,
    [cohortId],
  );
  return toNonNegativeInteger(result.rows[0]?.seat_number ?? 1);
}

function toNonNegativeInteger(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CohortCapacityUnavailableError(
      `capacity value is not a non-negative integer`,
    );
  }
  return parsed;
}

function summarizeCapacityError(err: unknown): string {
  if (err instanceof Error) {
    return err.name || "Error";
  }
  return "unknown";
}

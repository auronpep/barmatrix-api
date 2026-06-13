// Mirror of barmatrix-app/lib/copy.ts — single source of truth for the
// public capacity copy phrasing returned by GET /api/cohort/status.
//
// Update only in lockstep with the SQL view cohort_public_status
// (BARMATRIX/engineering/SCHEMA_MYSQL.sql) and the locked phrases in
// BARMATRIX/DRIFT_CONTROL.md.

export const CAPACITY_COPY = {
  open: "July-cycle cohort enrollment is open.",
  limited: "July-cycle cohort enrollment is open.",
  almost_full: "July-cycle cohort enrollment is open.",
  last_seats: "July-cycle cohort enrollment is open.",
  waitlist: "Enrollment is currently paused. Contact support for the next available start.",
} as const;

export type CohortPublicStatus = keyof typeof CAPACITY_COPY;

export function publicCopyForCohortStatus(
  status: CohortPublicStatus | string | null | undefined,
): string {
  if (status && status in CAPACITY_COPY) {
    return CAPACITY_COPY[status as CohortPublicStatus];
  }
  return CAPACITY_COPY.open;
}

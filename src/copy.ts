// Mirror of barmatrix-app/lib/copy.ts — single source of truth for the
// public capacity copy phrasing returned by GET /api/cohort/status.
//
// Update only in lockstep with the SQL view cohort_public_status
// (BARMATRIX/engineering/SCHEMA_MYSQL.sql) and the locked phrases in
// BARMATRIX/DRIFT_CONTROL.md.

export const CAPACITY_COPY = {
  open: "July-cycle cohort enrollment is open. Limited seats available.",
  limited: "Limited July-cycle cohort seats available.",
  almost_full: "The July-cycle cohort is almost full.",
  last_seats: "Last July-cycle cohort seats available.",
  waitlist: "Cohort capacity reached. Join the waitlist.",
} as const;

export type CohortPublicStatus = keyof typeof CAPACITY_COPY;

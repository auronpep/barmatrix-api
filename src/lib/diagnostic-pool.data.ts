// diagnostic-pool.data.ts - content reset placeholder.

export type DiagnosticPoolRole = "hard_set" | "random" | "bench";

export interface DiagnosticPoolEntry {
  externalId: string;
  subject: string;
  role: DiagnosticPoolRole;
  order: number;
}

export const DIAGNOSTIC_LENGTH = 0;
export const HARD_SET_COUNT = 0;
export const RANDOM_PULL_COUNT = 0;

export const DIAGNOSTIC_POOL: DiagnosticPoolEntry[] = [];

// Guided path content reset placeholder.
import type { PathStep } from "./path-engine.js";

export const PATH_VERSION = 2;
export const CRIMINAL_SET_1_ID = "0d1c0001-0000-4000-8000-000000000001";
export const CRIMINAL_SET_2_ID = "0d1c0002-0000-4000-8000-000000000002";
export const CRIMINAL_DAY1_DECK_ID = "criminal-law-day1";
export const CRIMINAL_DOCTRINAL_SLUG = "criminal-law-day1";

export const PATH_STEPS: PathStep[] = [];

export const PATH_DAY_COUNT = PATH_STEPS.reduce(
  (max, s) => Math.max(max, s.day),
  1,
);

export function getPathStepById(stepId: string): PathStep | null {
  return PATH_STEPS.find((s) => s.id === stepId) ?? null;
}

// C3 Certification content accessors + pure helpers. Imports CONTENT (client-safe)
// and KEYS (server-only). The PublicCertItem type has NO key fields, so the content
// shaper cannot leak a key (tsc-enforced).
import { CERT_CONTENT } from "./cert-content.data.js";
import { CERT_KEYS } from "./cert-keys.data.js";

export type Capture = "single" | "rule_distractor" | "axis_survivor" | "band" | "integration";
export type CompetencyId = "M1"|"M2"|"M3"|"M4"|"M5"|"M6"|"M7"|"M8"|"M9"|"M10";

export interface SurvivorOption { letter: string; text: string }
export interface McqOption { letter: string; text: string }

// CLIENT-SAFE item: prompt + option arrays only. NO key fields exist on this type.
export interface PublicCertItem {
  id: string; prompt: string;
  options?: McqOption[];
  axis_options?: string[]; survivor_options?: SurvivorOption[];
}
export interface PassSpec {
  type: "min_correct" | "calibration" | "integration";
  n?: number; of?: number; band_match_min?: number; no_undercalled_cut?: boolean;
  accuracy?: { n: number; of: number }; phase_min?: number;
}
export interface PublicCompetency {
  id: CompetencyId; title: string; capture: Capture; pass: PassSpec; lesson_refs: string[];
  label_options?: string[]; rule_options?: string[]; distractor_options?: string[];
  band_options?: string[]; phase_options?: string[];
  items: PublicCertItem[];
}
export interface PublicCertContent {
  title: string; preview: boolean; preview_note: string; overall_gate: string;
  competencies: PublicCompetency[];
}

// SERVER-ONLY key shapes.
export interface CertKeyItem {
  id: string; key?: string; key_rule?: string; key_distractor?: string;
  key_axis?: string; key_survivor?: string; key_band?: "HIGH"|"MED"|"COIN";
  key_answer?: string; key_phase?: "CUT"|"CLASH"|"CALL";
  mechanism?: string; is_clean_or_anchor?: boolean; is_deterministic?: boolean; is_fork?: boolean;
  explanation?: string; review_note?: string;
}
export interface CertKeyCompetency {
  pass: PassSpec; capture: Capture; remediation_lessons: string[]; items: CertKeyItem[];
}
export type CertKeys = Record<string, CertKeyCompetency>;

export function getCertContent(): PublicCertContent { return CERT_CONTENT; }
export function getCertOutline(): PublicCertContent { return CERT_CONTENT; }
export function getPublicCompetency(id: string): PublicCompetency | null {
  return CERT_CONTENT.competencies.find((c) => c.id === id) ?? null;
}
export function getKeys(id: string): CertKeyCompetency | null { return CERT_KEYS[id] ?? null; }
export function isValidCompetencyId(id: unknown): id is CompetencyId {
  return typeof id === "string" && /^M([1-9]|10)$/.test(id);
}

// Retake cooldown: attempt 1 free, then 1h, 24h, 72h (capped).
export const COOLDOWN_STEPS_MS = [0, 3_600_000, 86_400_000, 259_200_000] as const;
export function cooldownMsFor(attemptsCount: number): number {
  if (attemptsCount <= 0) return 0;
  const idx = Math.min(attemptsCount, COOLDOWN_STEPS_MS.length - 1);
  return COOLDOWN_STEPS_MS[idx]!;
}

export function overallStatus(passedById: Record<string, boolean>): "CONFIRMED" | "NOT_YET" {
  const ids = CERT_CONTENT.competencies.map((c) => c.id);
  if (ids.length === 0) return "NOT_YET";
  return ids.every((id) => passedById[id] === true) ? "CONFIRMED" : "NOT_YET";
}

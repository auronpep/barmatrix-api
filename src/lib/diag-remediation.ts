// DIAG v1 remediation bundles: typed, indexed access to the 51 executable
// micro-bundles (one per remediation_id) staged from REMEDIATION_BUNDLES_v1.yaml.
//
// The YAML has no parser in this repo, so it is converted once to JSON at
// src/data/c3-subjects/diag/remediation_bundles.json and imported here.

import bundleSet from "../data/c3-subjects/diag/remediation_bundles.json" with { type: "json" };

export type C3Phase = "CUT" | "CLASH" | "CALL";

export interface BundleSourceInstance {
  question_id: string;
  subject: string;
  topic?: string;
  difficulty?: string;
  original_choice?: string;
  forensic_tags?: string[];
  choice_text?: string;
}

export interface C3Profile {
  route_family: string;
  failure_mode: string;
  c3_phase: C3Phase;
  confidence_class: string;
  primary_skill: string;
  subjects: string[];
}

export interface AssignedPath {
  lesson_route: string[];
  subject_overlay: string;
  tiny_anchor: string;
}

export interface MicroSequenceStep {
  step: number;
  name: string;
  duration_minutes: number;
  student_task: string;
  success_check: string;
}

export interface BundleEscalation {
  if_mastery_gate_failed?: string;
  if_same_route_family_repeats?: string;
  if_correct_but_low_confidence?: string;
  [key: string]: string | undefined;
}

export interface BundleInstrumentation {
  record_attempt_fields?: string[];
  post_bundle_fields?: string[];
}

export interface RemediationBundle {
  bundle_id: string;
  remediation_id: string;
  title: string;
  status: string;
  source_instances: BundleSourceInstance[];
  diagnostic_trigger: string;
  student_facing_diagnosis: string;
  c3_profile: C3Profile;
  assigned_path: AssignedPath;
  micro_sequence: MicroSequenceStep[];
  mastery_gate: string;
  instrumentation?: BundleInstrumentation;
  escalation: BundleEscalation;
}

const ALL_BUNDLES: RemediationBundle[] = (bundleSet as { bundles: RemediationBundle[] })
  .bundles;

const BUNDLE_BY_REMEDIATION_ID: Map<string, RemediationBundle> = new Map(
  ALL_BUNDLES.map((b) => [b.remediation_id, b]),
);

const VALID_PHASES: ReadonlySet<C3Phase> = new Set<C3Phase>(["CUT", "CLASH", "CALL"]);

/** Look up a single bundle by its remediation_id. Returns null if unknown. */
export function getBundle(remediationId: string): RemediationBundle | null {
  return BUNDLE_BY_REMEDIATION_ID.get(remediationId) ?? null;
}

/** All staged bundles (defensive copy of the array). */
export function allBundles(): RemediationBundle[] {
  return [...ALL_BUNDLES];
}

/** Total number of staged bundles. */
export function bundleCount(): number {
  return ALL_BUNDLES.length;
}

/** Group bundles by their c3_profile.route_family. */
export function bundlesByRouteFamily(): Map<string, RemediationBundle[]> {
  const grouped = new Map<string, RemediationBundle[]>();
  for (const bundle of ALL_BUNDLES) {
    const family = bundle.c3_profile.route_family;
    const existing = grouped.get(family);
    if (existing) {
      existing.push(bundle);
    } else {
      grouped.set(family, [bundle]);
    }
  }
  return grouped;
}

/** Count of bundles per C3 phase (CUT / CLASH / CALL). */
export function c3PhaseCounts(): Record<C3Phase, number> {
  const counts: Record<C3Phase, number> = { CUT: 0, CLASH: 0, CALL: 0 };
  for (const bundle of ALL_BUNDLES) {
    const phase = bundle.c3_profile.c3_phase;
    if (VALID_PHASES.has(phase)) {
      counts[phase] += 1;
    }
  }
  return counts;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const EXPECTED_BUNDLE_COUNT = 0;

/**
 * Structural validation of the staged bundle set. Checks:
 * - exactly 51 bundles
 * - every bundle_id === "BUNDLE-" + remediation_id
 * - every c3_phase is one of CUT/CLASH/CALL
 * - mastery_gate present (non-empty)
 * - micro_sequence non-empty
 */
export function validateBundles(): ValidationResult {
  const errors: string[] = [];

  if (ALL_BUNDLES.length !== EXPECTED_BUNDLE_COUNT) {
    errors.push(
      `expected ${EXPECTED_BUNDLE_COUNT} bundles, found ${ALL_BUNDLES.length}`,
    );
  }

  for (const bundle of ALL_BUNDLES) {
    const expectedId = `BUNDLE-${bundle.remediation_id}`;
    if (bundle.bundle_id !== expectedId) {
      errors.push(
        `bundle_id mismatch: ${bundle.bundle_id} !== ${expectedId}`,
      );
    }
    if (!VALID_PHASES.has(bundle.c3_profile?.c3_phase)) {
      errors.push(
        `${bundle.remediation_id}: invalid c3_phase ${String(
          bundle.c3_profile?.c3_phase,
        )}`,
      );
    }
    if (!bundle.mastery_gate || bundle.mastery_gate.trim().length === 0) {
      errors.push(`${bundle.remediation_id}: missing mastery_gate`);
    }
    if (!Array.isArray(bundle.micro_sequence) || bundle.micro_sequence.length === 0) {
      errors.push(`${bundle.remediation_id}: empty micro_sequence`);
    }
  }

  return { ok: errors.length === 0, errors };
}

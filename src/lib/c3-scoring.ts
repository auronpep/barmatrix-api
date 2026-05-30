// barmatrix-api/src/lib/c3-scoring.ts
// Pure C3 mastery scoring. No DB/HTTP — unit-tested. Corrected per design-critic:
// exposures count any attempt on a question containing the mold; proficiency is
// difficulty-weighted; calibration is a SEPARATE track, never folded into readiness.

export const MOLD_FLOOR = 8; // min exposures before a mold is "measured"

export type Family = "EAR_OVERCLAIM" | "EAR_FALSITY" | "EAR_DISTORTION" | "ISSUE_SENSE";

export interface MoldRow {
  mold_code: string;
  family: Family;
  weight: number;       // c3_molds.default_exam_weight
  exposures: number;    // attempts on questions where this mold appears on any choice
  bites: number;        // exposures where the student picked this mold's choice
  w_exposure: number;   // difficulty-weighted exposures
  w_bite: number;       // difficulty-weighted bites
}

export interface MoldProficiency {
  measured: boolean;
  proficiency: number | null; // 1 - difficulty-weighted bite rate
  bite_pct: number;           // raw bites/exposures * 100 (for display)
}

export function moldProficiency(r: Pick<MoldRow, "exposures" | "bites" | "w_exposure" | "w_bite">): MoldProficiency {
  const measured = r.exposures >= MOLD_FLOOR;
  const wbr = r.w_exposure > 0 ? r.w_bite / r.w_exposure : 0;
  return {
    measured,
    proficiency: measured ? round2(1 - wbr) : null,
    bite_pct: r.exposures > 0 ? Math.round((r.bites / r.exposures) * 100) : 0,
  };
}

export interface FamilyProficiency {
  family: Family;
  proficiency: number | null; // exam-weight-weighted across measured molds
  weight: number;             // summed exam weight of the family's measured molds
  measured_molds: number;
}

export function rollupFamilies(rows: MoldRow[]): FamilyProficiency[] {
  const byFamily = new Map<Family, MoldRow[]>();
  for (const r of rows) {
    const list = byFamily.get(r.family) ?? [];
    list.push(r);
    byFamily.set(r.family, list);
  }
  const out: FamilyProficiency[] = [];
  for (const [family, list] of byFamily) {
    const measured = list.filter((r) => r.exposures >= MOLD_FLOOR);
    const wsum = measured.reduce((s, r) => s + r.weight, 0);
    const prof =
      measured.length === 0 || wsum === 0
        ? null
        : round2(
            measured.reduce((s, r) => s + r.weight * (1 - (r.w_exposure > 0 ? r.w_bite / r.w_exposure : 0)), 0) / wsum,
          );
    out.push({ family, proficiency: prof, weight: round4(wsum), measured_molds: measured.length });
  }
  return out;
}

// Accuracy-only composite (0-100). Calibration is NOT included.
export function overallReadiness(
  fams: Array<Pick<FamilyProficiency, "family" | "proficiency" | "weight" | "measured_molds">>,
): number | null {
  const measured = fams.filter((f) => f.proficiency !== null && f.measured_molds > 0);
  const wsum = measured.reduce((s, f) => s + f.weight, 0);
  if (measured.length === 0 || wsum === 0) return null;
  const acc = measured.reduce((s, f) => s + f.weight * (f.proficiency as number), 0) / wsum;
  return Math.round(acc * 100);
}

export interface ConfBucket { confidence: number; actual: number; n: number; }
// Map stated confidence (1-5) to the accuracy it implies (Lesson 13 bands).
const CONF_EXPECTED: Record<number, number> = { 1: 0.5, 2: 0.62, 3: 0.72, 4: 0.82, 5: 0.9 };

export function calibrationError(buckets: ConfBucket[]): {
  error: number; direction: "overconfident" | "underconfident" | "calibrated"; buckets: ConfBucket[];
} {
  const usable = buckets.filter((b) => b.n > 0 && CONF_EXPECTED[b.confidence] !== undefined);
  if (usable.length === 0) return { error: 0, direction: "calibrated", buckets };
  const totalN = usable.reduce((s, b) => s + b.n, 0);
  let signed = 0;
  for (const b of usable) signed += (b.n / totalN) * (CONF_EXPECTED[b.confidence]! - b.actual);
  const error = round2(Math.abs(signed));
  const direction = signed > 0.05 ? "overconfident" : signed < -0.05 ? "underconfident" : "calibrated";
  return { error, direction, buckets };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

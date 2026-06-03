// Pure flag-quality calibration metrics (triage A5). No DB/HTTP — unit-tested.
//
// Builds on student_attempts.flagged (triage A2). "Flag quality" measures whether
// a student recognizes their own uncertainty: do they flag the items they get
// wrong while unsure, and are their flags precise (not wasted on items they know)?
//
// LOW_CONF_MAX: confidence (1–5 self-rating) at/below which an unflagged miss is
// considered an UNRECOGNIZED coin — the student was unsure, got it wrong, and did
// not flag it.
export const LOW_CONF_MAX = 2;

export interface FlagQualityRaw {
  flagged_wrong: number; // flagged AND incorrect
  flagged_right: number; // flagged AND correct
  unflagged_lowconf_miss: number; // not flagged, incorrect, confidence <= LOW_CONF_MAX
  flagged_total: number; // all flagged attempts
  n: number; // total annotated attempts considered
}

export interface FlagQuality {
  flagged_wrong: number;
  flagged_right: number;
  unflagged_lowconf_miss: number;
  flagged_total: number;
  n: number;
  // Of the low-confidence misses the student SHOULD have recognized
  // (flagged_wrong + unflagged_lowconf_miss), the share they actually flagged.
  // High = good coin recognition. null when there were none to recognize.
  coin_recognition_rate: number | null;
  // When the student flags, how often they were actually wrong. High = flags are
  // meaningful (not spent on items they know). null when no flags.
  flag_precision: number | null;
}

const ratio = (numerator: number, denom: number): number | null =>
  denom > 0 ? Math.round((numerator / denom) * 1000) / 1000 : null;

export function flagQuality(raw: FlagQualityRaw): FlagQuality {
  const recognizable = raw.flagged_wrong + raw.unflagged_lowconf_miss;
  return {
    flagged_wrong: raw.flagged_wrong,
    flagged_right: raw.flagged_right,
    unflagged_lowconf_miss: raw.unflagged_lowconf_miss,
    flagged_total: raw.flagged_total,
    n: raw.n,
    coin_recognition_rate: ratio(raw.flagged_wrong, recognizable),
    flag_precision: ratio(raw.flagged_wrong, raw.flagged_total),
  };
}

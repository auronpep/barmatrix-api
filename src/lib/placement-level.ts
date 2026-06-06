export interface PlacementLevel {
  level: number;
  label: string;
  description: string;
  route: string[];
}

export function levelForScore(totalScore: number, attempts: number): PlacementLevel {
  const max = Math.max(1, attempts * 3);
  const pct = totalScore / max;
  if (pct >= 0.85) {
    return {
      level: 4,
      label: "L4 · Exam-ready refinement",
      description: "You are showing strong accuracy, mechanism recognition, and calibration. Start with timed refinement and red-zone cleanup.",
      route: ["Timed refinement", "Red-zone repair", "Certification practice"],
    };
  }
  if (pct >= 0.68) {
    return {
      level: 3,
      label: "L3 · Targeted repair",
      description: "You have the core approach. Your best return is targeted work on the traps surfaced by this placement.",
      route: ["Red-zone repair", "C3 calibration", "Mixed timed sets"],
    };
  }
  if (pct >= 0.5) {
    return {
      level: 2,
      label: "L2 · Build the method",
      description: "You have enough traction to start applying the method, but the placement shows recurring misses to repair.",
      route: ["The Method", "Foundational drills", "Red-zone repair"],
    };
  }
  if (pct >= 0.3) {
    return {
      level: 1,
      label: "L1 · Method foundations",
      description: "Start with the core C3 workflow before pushing timed mixed practice.",
      route: ["The Method", "Untimed subject drills", "Confidence calibration"],
    };
  }
  return {
    level: 0,
    label: "L0 · Start from first principles",
    description: "Begin with the foundations so the later repair work has a stable base.",
    route: ["The Method", "Foundational rule work", "Short untimed sets"],
  };
}

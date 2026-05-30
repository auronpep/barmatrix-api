import type { CertKeyCompetency } from "./cert.js";

export interface SubmittedAnswer {
  id: string;
  value?: string;                 // single/integration answer letter/label
  rule?: string; distractor?: string;   // rule_distractor
  axis?: string; survivor?: string;     // axis_survivor
  band?: "HIGH" | "MED" | "COIN";       // band/integration
  phase?: "CUT" | "CLASH" | "CALL";     // integration
  flag?: boolean;                       // integration
}
export interface PerItemResult {
  id: string; correct: boolean; your: string | null; key: string | null; explanation?: string;
}
export interface GradeResult {
  passed: boolean; score: number;
  accuracy_score: number | null; forks_passed: boolean | null;
  phase_score: number | null; calibration_passed: boolean | null;
  per_item: PerItemResult[];
}

function byId(answers: SubmittedAnswer[]): Map<string, SubmittedAnswer> {
  return new Map(answers.map((a) => [a.id, a]));
}

export function gradeCompetency(comp: CertKeyCompetency, answers: SubmittedAnswer[]): GradeResult {
  const a = byId(answers);
  const per_item: PerItemResult[] = [];
  let score = 0;
  let accuracy_score: number | null = null;
  let forks_passed: boolean | null = null;
  let phase_score: number | null = null;
  let calibration_passed: boolean | null = null;

  if (comp.capture === "single") {
    for (const it of comp.items) {
      const ans = a.get(it.id)?.value ?? null;
      const correct = ans === it.key;
      if (correct) score++;
      per_item.push({ id: it.id, correct, your: ans, key: it.key ?? null, explanation: it.explanation });
    }
    return finalize(comp, { passed: score >= (comp.pass.n ?? 0), score, accuracy_score, forks_passed, phase_score, calibration_passed, per_item });
  }
  if (comp.capture === "rule_distractor") {
    for (const it of comp.items) {
      const ans = a.get(it.id);
      const correct = ans?.rule === it.key_rule && ans?.distractor === it.key_distractor;
      if (correct) score++;
      per_item.push({ id: it.id, correct, your: `${ans?.rule ?? "-"}/${ans?.distractor ?? "-"}`,
        key: `${it.key_rule}/${it.key_distractor}`, explanation: it.explanation });
    }
    return finalize(comp, { passed: score >= (comp.pass.n ?? 0), score, accuracy_score, forks_passed, phase_score, calibration_passed, per_item });
  }
  if (comp.capture === "axis_survivor") {
    for (const it of comp.items) {
      const ans = a.get(it.id);
      const correct = ans?.axis === it.key_axis && ans?.survivor === it.key_survivor;
      if (correct) score++;
      per_item.push({ id: it.id, correct, your: `${ans?.axis ?? "-"} / ${ans?.survivor ?? "-"}`,
        key: `${it.key_axis} / ${it.key_survivor}`, explanation: it.explanation });
    }
    return finalize(comp, { passed: score >= (comp.pass.n ?? 0), score, accuracy_score, forks_passed, phase_score, calibration_passed, per_item });
  }
  if (comp.capture === "band") {
    let undercalled = false;
    for (const it of comp.items) {
      const band = a.get(it.id)?.band ?? null;
      const correct = band === it.key_band;
      if (correct) score++;
      if (it.is_clean_or_anchor && band !== "HIGH") undercalled = true;
      per_item.push({ id: it.id, correct, your: band, key: it.key_band ?? null, explanation: it.explanation });
    }
    calibration_passed = score >= (comp.pass.band_match_min ?? 0) && !(comp.pass.no_undercalled_cut && undercalled);
    return finalize(comp, { passed: calibration_passed, score, accuracy_score, forks_passed, phase_score, calibration_passed, per_item });
  }
  // integration
  let detCorrect = 0;
  let forksOk = true;
  for (const it of comp.items) {
    const ans = a.get(it.id);
    const answerCorrect = ans?.value === it.key_answer;
    const phaseCorrect = ans?.phase === it.key_phase;
    if (it.is_deterministic && answerCorrect) detCorrect++;
    if (it.is_fork && ans?.flag !== true) forksOk = false;
    per_item.push({
      id: it.id,
      correct: answerCorrect && phaseCorrect,
      your: `${ans?.value ?? "-"}/${ans?.phase ?? "-"}${it.is_fork ? `/flag:${ans?.flag ?? false}` : ""}`,
      key: `${it.key_answer}/${it.key_phase}${it.is_fork ? "/flag:true" : ""}`,
      explanation: it.explanation,
    });
  }
  const phaseScore = comp.items.filter((it) => a.get(it.id)?.phase === it.key_phase).length;
  accuracy_score = detCorrect; forks_passed = forksOk; phase_score = phaseScore; score = detCorrect;
  const accOk = detCorrect >= (comp.pass.accuracy?.n ?? 0);
  const phaseOk = phaseScore >= (comp.pass.phase_min ?? 0);
  return finalize(comp, { passed: accOk && forksOk && phaseOk, score, accuracy_score, forks_passed, phase_score, calibration_passed, per_item });
}

function finalize(_comp: CertKeyCompetency, r: GradeResult): GradeResult { return r; }

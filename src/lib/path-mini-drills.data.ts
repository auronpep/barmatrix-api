// J7 Mini-Drill content reset placeholder.

export type MiniDrillType = "charge_picker" | "trap_spotter";

export interface MiniDrillChoice {
  id: string;
  text: string;
}

export interface MiniDrillQuestion {
  id: string;
  stem: string;
  choices: MiniDrillChoice[];
  answer_id: string;
  explanation: string;
}

export interface MiniDrill {
  drill_id: string;
  drill_type: MiniDrillType;
  title: string;
  subject: string;
  instruction: string;
  questions: MiniDrillQuestion[];
}

const DRILLS: MiniDrill[] = [];

export function getMiniDrill(drillId: string): MiniDrill | null {
  return DRILLS.find((d) => d.drill_id === drillId) ?? null;
}

export function shapeMiniDrill(drill: MiniDrill): object {
  return {
    drill_id: drill.drill_id,
    drill_type: drill.drill_type,
    title: drill.title,
    subject: drill.subject,
    instruction: drill.instruction,
    question_count: drill.questions.length,
    questions: drill.questions.map((q) => ({
      id: q.id,
      stem: q.stem,
      choices: q.choices,
      answer_id: q.answer_id,
      explanation: q.explanation,
    })),
  };
}

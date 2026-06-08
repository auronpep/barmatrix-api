// J7 Mini-Drill content — 3-5 question interactive drills drawn from
// BARMATRIX/engineering/CrimLaw_MasterSheet content. Two sub-types:
//   charge_picker  — fact pattern → pick the correct charge/degree (multiple choice)
//   trap_spotter   — identify the wrong answer choice + explanation of why it fails
//
// Completion is self-declared: student views all questions + explanations, then
// the "Done" button fires POST /api/me/path/:stepId/complete.
// No attorney gating needed — no test questions, only rule applications.

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

const DRILLS: MiniDrill[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 1: Homicide Degree Decision Tree (charge_picker, 4 questions)
  // Sourced from: Homicide Degree Decision Tree + Malice Quartet (Part 1)
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-homicide-degree",
    drill_type: "charge_picker",
    title: "Homicide Degree Decision Tree",
    subject: "Criminal Law",
    instruction:
      "Read each fact pattern and pick the most serious provable charge. Work top-down: 1st degree → 2nd degree → voluntary manslaughter → involuntary manslaughter.",
    questions: [
      {
        id: "hddt-q1",
        stem: "The night before a meeting, defendant decided to kill his business partner. The next morning he shot him once in the head, killing him instantly.",
        choices: [
          { id: "a", text: "1st degree murder" },
          { id: "b", text: "2nd degree murder" },
          { id: "c", text: "Voluntary manslaughter" },
          { id: "d", text: "Involuntary manslaughter" },
        ],
        answer_id: "a",
        explanation:
          "Intentional + premeditated + deliberate = 1st degree murder. The overnight plan establishes premeditation. Deliberation means cool reflection on the decision, which a night's sleep supports.",
      },
      {
        id: "hddt-q2",
        stem: "Defendant fired his gun into a crowded subway car as the doors closed, not aiming at anyone in particular. A bullet struck a passenger, killing her.",
        choices: [
          { id: "a", text: "1st degree murder" },
          { id: "b", text: "2nd degree murder (depraved heart)" },
          { id: "c", text: "Voluntary manslaughter" },
          { id: "d", text: "Involuntary manslaughter" },
        ],
        answer_id: "b",
        explanation:
          "Firing into a crowd = conscious disregard of an unjustifiably high risk to human life = depraved heart malice = 2nd degree murder. No premeditation/deliberation, so not 1st degree. NOT manslaughter — depraved heart satisfies malice and lands above the manslaughter line.",
      },
      {
        id: "hddt-q3",
        stem: "Defendant came home and found his spouse in bed with another person. In a blind rage, he grabbed a lamp from the nightstand and struck the other person, who died from the blow. No time passed between discovery and the blow.",
        choices: [
          { id: "a", text: "1st degree murder" },
          { id: "b", text: "2nd degree murder" },
          { id: "c", text: "Voluntary manslaughter" },
          { id: "d", text: "Involuntary manslaughter" },
        ],
        answer_id: "c",
        explanation:
          "Classic voluntary manslaughter: (1) actual provocation (catching a spouse in the act is adequate), (2) reasonable person would be provoked, (3) no cooling time (immediate blow), (4) defendant did not actually cool off. Murder is reduced to voluntary manslaughter.",
      },
      {
        id: "hddt-q4",
        stem: "Defendant was driving 25 mph over the speed limit while texting. He didn't see a pedestrian cross at a crosswalk and struck her. She died at the hospital.",
        choices: [
          { id: "a", text: "1st degree murder" },
          { id: "b", text: "2nd degree murder" },
          { id: "c", text: "Voluntary manslaughter" },
          { id: "d", text: "Involuntary manslaughter" },
        ],
        answer_id: "d",
        explanation:
          "Criminally negligent (gross deviation from the standard of care) but no conscious disregard of a high risk = involuntary manslaughter, not murder. If defendant had been aware of and consciously disregarded the risk, it would be depraved heart murder. Texting + speeding = negligent, not consciously reckless.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 2: Trap Spotter — Homicide (trap_spotter, 3 questions)
  // Sourced from: Part 1 traps + Part 7 Answer Intelligence table
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-trap-spotter-homicide",
    drill_type: "trap_spotter",
    title: "Trap Spotter: Homicide Edition",
    subject: "Criminal Law",
    instruction:
      "Each question shows a fact pattern and four answer choices. One choice is a classic MBE trap — it sounds right but loses you points. Identify which one and learn why.",
    questions: [
      {
        id: "tsh-q1",
        stem: "Defendant swung a baseball bat at his coworker's head with full force, intending to cause serious injury. The coworker died from the blow. Which answer choice is the MBE trap?",
        choices: [
          {
            id: "a",
            text: "Not guilty of murder because defendant did not intend to kill",
          },
          {
            id: "b",
            text: "Guilty of 2nd degree murder under the intent-to-cause-serious-bodily-harm theory",
          },
          {
            id: "c",
            text: "Guilty of murder; malice does not require an intent to kill",
          },
          {
            id: "d",
            text: "Guilty of murder; using a deadly weapon on a vital body part satisfies malice",
          },
        ],
        answer_id: "a",
        explanation:
          "Choice A is the trap — eliminate it immediately. Intent to kill is only ONE of the four malice theories. Intent to cause serious bodily harm is a separate, independent basis for malice. 26% of test takers missed Q#1423 (hammer to the head) because they assumed no intent to kill = no murder. Wrong. Choices B, C, and D are all valid correct answers depending on phrasing.",
      },
      {
        id: "tsh-q2",
        stem: "Defendant knew the hallway of a crowded apartment building was full of people when he opened fire at the far end. He killed a tenant. Which answer choice would lose you points on the MBE?",
        choices: [
          {
            id: "a",
            text: "Guilty of 2nd degree (depraved heart) murder",
          },
          {
            id: "b",
            text: "Guilty of involuntary manslaughter; he did not intend to kill anyone",
          },
          {
            id: "c",
            text: "Guilty of murder under implied malice / extreme recklessness theory",
          },
          {
            id: "d",
            text: "Guilty of murder; conscious disregard of a high risk to human life satisfies malice",
          },
        ],
        answer_id: "b",
        explanation:
          "Choice B is the #1 homicide degree error — 45% of test takers make it. Consciously disregarding an obvious, high risk to human life is DEPRAVED HEART MURDER (2nd degree), not involuntary manslaughter. Involuntary manslaughter requires criminally negligent conduct without conscious disregard. Knowingly firing into a crowd = aware of the risk = murder.",
      },
      {
        id: "tsh-q3",
        stem: "Defendant discovered his wife was having an affair. He drove around for four hours, then returned home and shot his wife's boyfriend. Which answer is wrong?",
        choices: [
          {
            id: "a",
            text: "Guilty of 1st or 2nd degree murder; the four-hour gap is sufficient cooling time",
          },
          {
            id: "b",
            text: "Guilty of voluntary manslaughter; discovering the affair was adequate provocation",
          },
          {
            id: "c",
            text: "The heat-of-passion defense fails; a reasonable person would have cooled after four hours",
          },
          {
            id: "d",
            text: "Not guilty of voluntary manslaughter; the defendant did not actually cool off but a reasonable person would have",
          },
        ],
        answer_id: "b",
        explanation:
          "Choice B is the trap. Voluntary manslaughter requires NO sufficient cooling time — and four hours is cooling time. The rule requires both (a) the defendant did not actually cool off AND (b) a reasonable person would not have cooled off by then. A four-hour drive breaks the heat-of-passion chain. The gap = cooled = murder. Choice D is also defensible on the facts (objective test fails even if subjective doesn't).",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 3: Voluntary Manslaughter Check (charge_picker, 3 questions)
  // Sourced from: Voluntary Manslaughter — Provocation Trap (Part 1)
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-voluntary-manslaughter",
    drill_type: "charge_picker",
    title: "Murder or Voluntary Manslaughter?",
    subject: "Criminal Law",
    instruction:
      "Each scenario involves a killing during or after some provocation. Decide: is this murder (any degree) or voluntary manslaughter? The key question is whether all four provocation requirements are satisfied.",
    questions: [
      {
        id: "vm-q1",
        stem: "Defendant's neighbor insulted him in front of a group of coworkers, calling him incompetent and a liar. Humiliated and furious, defendant immediately pulled out a pen from his pocket, stabbed the neighbor with it, and the neighbor died.",
        choices: [
          { id: "a", text: "Voluntary manslaughter — adequate provocation" },
          {
            id: "b",
            text: "Murder — words alone are almost never adequate provocation at common law",
          },
        ],
        answer_id: "b",
        explanation:
          "Words alone — insults, taunts, verbal humiliation — are almost never adequate provocation at common law. No matter how infuriating, verbal abuse without physical contact does not meet the 'adequate provocation' element. This is murder (degree depends on premeditation), not voluntary manslaughter.",
      },
      {
        id: "vm-q2",
        stem: "During a heated argument, the victim suddenly punched defendant in the face with full force, breaking his nose. In that same moment, defendant grabbed a nearby wrench and struck the victim in the head. The victim died.",
        choices: [
          {
            id: "a",
            text: "Voluntary manslaughter — battery is adequate provocation, no cooling time",
          },
          {
            id: "b",
            text: "Murder — defendant used disproportionate force in response",
          },
        ],
        answer_id: "a",
        explanation:
          "All four elements are met: (1) actual provocation (punch = battery), (2) reasonable person would be provoked, (3) no cooling time (immediate response), (4) defendant did not actually cool off. This is a textbook voluntary manslaughter scenario. The proportionality of force matters for self-defense analysis, not for provocation — the killing is still voluntary manslaughter.",
      },
      {
        id: "vm-q3",
        stem: "Defendant learned Monday morning that his brother had been murdered over the weekend. He was devastated and furious. After two days of grief and rage, he tracked down and killed the suspected perpetrator on Wednesday.",
        choices: [
          {
            id: "a",
            text: "Voluntary manslaughter — the grief over a murdered family member is adequate provocation",
          },
          {
            id: "b",
            text: "Murder — a two-day gap is sufficient cooling time regardless of the provocation's severity",
          },
        ],
        answer_id: "b",
        explanation:
          "Even severe, legitimate grief fails the cooling-time requirement after two days. The provocation may have been real and a reasonable person might have felt it deeply — but the question is whether a reasonable person would still be in the heat of passion after 48 hours. The answer is no. Cooling time bars the manslaughter reduction and this is murder. (Revenge killings are almost always murder, not manslaughter.)",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 4: Answer Intelligence Drill (trap_spotter, 4 questions)
  // Sourced from: Part 7 — Answer Choices to Eliminate Immediately
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-answer-intelligence",
    drill_type: "trap_spotter",
    title: "Answer Intelligence: Eliminate on Sight",
    subject: "Criminal Law",
    instruction:
      "These are answer choices that appear on the MBE and are almost always wrong. For each question, identify the answer you should eliminate immediately — and know the rule that kills it.",
    questions: [
      {
        id: "ai-q1",
        stem: "In a robbery prosecution, the victim was punched before her purse was taken. You see two answer choices: (A) 'Guilty of robbery and battery' — (B) 'Guilty of robbery only.' Which do you eliminate?",
        choices: [
          {
            id: "a",
            text: "Eliminate A — battery is a lesser-included offense of robbery and merges into it; you cannot convict of both",
          },
          {
            id: "b",
            text: "Eliminate B — battery is a separate crime that should be charged alongside robbery",
          },
        ],
        answer_id: "a",
        explanation:
          "Battery merges into robbery. Robbery = larceny + force or intimidation, and battery is already embedded in the 'force' element. Convicting of both would punish the same conduct twice. 'Robbery and battery' as two separate convictions is almost always wrong on the MBE — eliminate it on sight.",
      },
      {
        id: "ai-q2",
        stem: "Defendant shot a gun into a crowd of people at a public event and killed someone. The prosecution charged murder. You see: 'Not guilty of murder — defendant did not intend to kill anyone.' Eliminate or keep?",
        choices: [
          {
            id: "a",
            text: "Eliminate — intent to kill is only ONE of four malice theories; depraved heart recklessness independently supports murder",
          },
          {
            id: "b",
            text: "Keep — murder requires proof of intent to kill the victim",
          },
        ],
        answer_id: "a",
        explanation:
          "Eliminate immediately. 'No intent to kill = no murder' is the single most common wrong answer in MBE homicide. Depraved heart recklessness — conscious disregard of an extreme risk to human life — is a standalone malice theory that supports murder with zero intent to kill. This answer appears in about 30% of homicide questions and is almost always wrong.",
      },
      {
        id: "ai-q3",
        stem: "A woman helped a felon escape town by lying to police about his whereabouts after learning of his crime. She is charged as accessory after the fact. The defense argues: 'The principal must be convicted first before she can be convicted.' Valid defense?",
        choices: [
          {
            id: "a",
            text: "Eliminate — a principal does NOT need to be convicted before an accessory after the fact can be convicted; accessory liability is independent",
          },
          {
            id: "b",
            text: "Keep — accessory after the fact liability depends on the principal's conviction",
          },
        ],
        answer_id: "a",
        explanation:
          "Eliminate immediately. Accessory after the fact liability is completely independent of whether the principal is convicted or even tried. The elements are: (1) the principal committed a felony, (2) the accessory knew about it, (3) the accessory helped with the purpose to prevent prosecution or conviction. The principal's conviction status is irrelevant.",
      },
      {
        id: "ai-q4",
        stem: "In a common law jurisdiction, defendant agreed to sell drugs with a person who turned out to be an undercover officer. He is charged with conspiracy. The answer choice reads: 'Guilty of conspiracy — an agreement was formed.' Eliminate or keep?",
        choices: [
          {
            id: "a",
            text: "Eliminate in common law — no conspiracy because the officer had no real intent to agree; common law requires bilateral agreement",
          },
          {
            id: "b",
            text: "Keep — the defendant genuinely agreed, which is sufficient for conspiracy",
          },
        ],
        answer_id: "a",
        explanation:
          "Common law conspiracy requires a BILATERAL agreement — both parties must genuinely intend to agree. An undercover officer has no real intent, so there is no mutual agreement and no conspiracy under common law. IMPORTANT: In a unilateral (MPC) jurisdiction, one party's genuine agreement IS enough — so the same 'guilty' answer would be correct. The jurisdiction tells you which rule applies. When you see 'common law' + undercover officer: no conspiracy.",
      },
    ],
  },
];

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

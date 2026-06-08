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

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 5: Attempt Traps (trap_spotter, 4 questions)
  // Sourced from: Part 2 — Attempt Framework + Q#700, Q#639, Q#854
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-attempt-traps",
    drill_type: "trap_spotter",
    title: "Attempt Traps",
    subject: "Criminal Law",
    instruction:
      "Each question has a wrong answer baked in. Identify which answer choice is the MBE trap and learn the rule that destroys it.",
    questions: [
      {
        id: "at-q1",
        stem: "A defendant fired a gun at a victim from a distance he later learns was too far for the bullet to reach. His lawyer argues 'factual impossibility — the gun could never have killed the victim at that range.' Which answer is the trap?",
        choices: [
          { id: "a", text: "Not guilty of attempted murder — factual impossibility prevents the crime" },
          { id: "b", text: "Guilty of attempted murder — factual impossibility is never a defense to attempt" },
          { id: "c", text: "Guilty of attempted murder — he had specific intent and took a substantial step" },
          { id: "d", text: "Not guilty — no crime occurred if completion was impossible" },
        ],
        answer_id: "a",
        explanation:
          "Choices A and D are traps. Factual impossibility — where the crime is impossible due to circumstances outside the defendant's control — is NEVER a defense to attempt. The defendant had the intent and took a substantial step. The only impossibility defense is LEGAL impossibility (where completion would not be a crime even if everything worked). Gun-too-short-range = factual impossibility = still guilty of attempt.",
      },
      {
        id: "at-q2",
        stem: "A man believed a 22-year-old woman was 16 based on her statements. He is charged with attempted statutory rape. Statutory rape in this jurisdiction is strict liability — no mental state required as to age. The best defense to the ATTEMPT charge is:",
        choices: [
          { id: "a", text: "Guilty — statutory rape requires no mental state as to age, so the attempt charge is the same" },
          { id: "b", text: "Not guilty — attempt always requires specific intent; he didn't intend sex with an underage person" },
          { id: "c", text: "Guilty — factual impossibility is not a defense" },
          { id: "d", text: "Not guilty — he was mistaken about an element" },
        ],
        answer_id: "a",
        explanation:
          "Choice A is the #1 inchoate trap — 47% of test takers chose it on Q#700. ATTEMPT always requires specific intent to commit the target crime — even if the completed crime is strict liability. Defendant genuinely believed the victim was 22. He lacked specific intent to have sex with an underage person. You can't attempt to do something you didn't know you were doing. Strict liability applies to the completed crime only.",
      },
      {
        id: "at-q3",
        stem: "A man pointed a gun at a teller and said 'give me the money.' The teller, feeling sorry for the disheveled man, voluntarily handed over $300 out of sympathy — not fear. Which charge is correct?",
        choices: [
          { id: "a", text: "Robbery — property changed hands after a threat was made" },
          { id: "b", text: "Attempted robbery — compliance was not due to the threat" },
          { id: "c", text: "Larceny — the property was taken" },
          { id: "d", text: "Extortion — a verbal threat was used" },
        ],
        answer_id: "b",
        explanation:
          "Choice A is the trap (Q#854 — 40% correct). Robbery requires the victim to comply BECAUSE OF the threat. When the teller gave money out of sympathy, not fear, the intimidation element failed. But factual impossibility (the attendant wasn't actually afraid) is never a defense to attempt — so the defendant is still guilty of ATTEMPTED robbery. No completed robbery; yes attempted robbery.",
      },
      {
        id: "at-q4",
        stem: "An owner attempted to burn down his own warehouse for the insurance money after his lawyer told him it would constitute arson. The fire was put out before spreading. What result?",
        choices: [
          { id: "a", text: "Guilty of attempted arson — he took a substantial step with intent" },
          { id: "b", text: "Not guilty — legal impossibility: burning your own building can never be arson" },
          { id: "c", text: "Guilty — his attorney's advice about arson establishes his intent" },
          { id: "d", text: "Not guilty — factual impossibility because the fire didn't succeed" },
        ],
        answer_id: "b",
        explanation:
          "Q#639 pattern. Legal impossibility IS a complete defense to attempt: where the completed act would not be a crime regardless of outcome. Arson requires burning 'the dwelling of another.' An owner cannot commit arson by burning his own building — even if he successfully completed every step. The lawyer's wrong advice doesn't create a crime where none exists. Compare factual impossibility (never a defense) vs. legal impossibility (always a defense).",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 6: Conspiracy Classification (charge_picker, 4 questions)
  // Sourced from: Part 2 — Conspiracy CL vs. MPC; Q#1354, Q#1584, Q#1358
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-conspiracy-traps",
    drill_type: "charge_picker",
    title: "Conspiracy: Common Law vs. MPC",
    subject: "Criminal Law",
    instruction:
      "Four conspiracy scenarios. The jurisdiction — common law or MPC — determines the outcome. Read it carefully before answering.",
    questions: [
      {
        id: "ct-q1",
        stem: "Common law jurisdiction. Maria agrees with undercover Officer Clark to steal cars. Maria believes Clark is a genuine criminal. They discuss the plan in detail. Maria is charged with conspiracy.",
        choices: [
          { id: "a", text: "Not guilty — common law requires bilateral agreement; the officer had no genuine criminal intent" },
          { id: "b", text: "Guilty — she genuinely agreed and that is sufficient" },
          { id: "c", text: "Guilty — an overt act (discussing the plan) was completed" },
          { id: "d", text: "Not guilty — no overt act at common law" },
        ],
        answer_id: "a",
        explanation:
          "At common law, conspiracy requires a BILATERAL agreement — both parties must genuinely intend to agree. An undercover officer has no real criminal intent. No mutual agreement = no conspiracy. (Note: at common law no overt act is required, but that's irrelevant here — there's no agreement at all.) Compare this to the MPC unilateral approach.",
      },
      {
        id: "ct-q2",
        stem: "MPC jurisdiction. Same facts: Maria agrees with undercover Officer Clark to steal cars. Maria genuinely intends to follow through. Is Maria guilty of conspiracy?",
        choices: [
          { id: "a", text: "Not guilty — she conspired with a person who lacked genuine intent" },
          { id: "b", text: "Guilty — MPC unilateral theory requires only one genuine agreement" },
          { id: "c", text: "Not guilty — no overt act was committed" },
          { id: "d", text: "Guilty — the officer's participation satisfies the bilateral requirement" },
        ],
        answer_id: "b",
        explanation:
          "The MPC uses a unilateral approach: only ONE party needs to genuinely agree. Maria's genuine intent to conspire is sufficient regardless of the officer's actual intent. This is the direct opposite of the common law result on the same facts. Jurisdiction is the decisive factor — 'unilateral' or 'MPC' = undercover officer conspiracy is valid.",
      },
      {
        id: "ct-q3",
        stem: "MPC jurisdiction. Alex and a foreign diplomat (who has full diplomatic immunity) agree to commit fraud together. The diplomat cannot be prosecuted. Can Alex be convicted of conspiracy?",
        choices: [
          { id: "a", text: "No — conspiracy requires two persons who can both be held liable" },
          { id: "b", text: "Yes — under MPC, a co-conspirator's personal defense does not negate the other's liability" },
          { id: "c", text: "No — common law bilateral requirement defeats Alex's conviction" },
          { id: "d", text: "Yes — but only because the diplomat acknowledged the agreement" },
        ],
        answer_id: "b",
        explanation:
          "Q#1358 pattern. Under the MPC unilateral approach, a co-conspirator's PERSONAL DEFENSE (like diplomatic immunity) does not negate the other party's liability. Alex genuinely agreed to conspire. Diplomatic immunity is a personal privilege of the diplomat — it doesn't un-form Alex's agreement. Alex is convicted of conspiracy.",
      },
      {
        id: "ct-q4",
        stem: "A 35-year-old man and the 15-year-old victim are charged with conspiracy to commit statutory rape. The victim voluntarily agreed to participate in the plan. Is the minor a valid co-conspirator?",
        choices: [
          { id: "a", text: "Yes — she voluntarily agreed, satisfying the bilateral requirement" },
          { id: "b", text: "No — members of a protected class cannot be co-conspirators for the crime designed to protect them" },
          { id: "c", text: "No — Wharton's Rule prevents conspiracy when the crime naturally requires two parties" },
          { id: "d", text: "Yes — if she was mature enough to agree, she can be charged" },
        ],
        answer_id: "b",
        explanation:
          "Q#1113 pattern. The protected class rule: when a statute is designed to protect a class of persons (minors in statutory rape), members of that class CANNOT be charged as co-conspirators for that crime. Statutory rape protects minors — the victim IS the protected person, not a co-criminal. Wharton's Rule (choice C) is wrong here: Wharton's Rule applies to crimes that require two participants by definition (bigamy, dueling). Statutory rape requires only ONE person — the adult.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 7: Theft Crime Classification (charge_picker, 4 questions)
  // Sourced from: Part 3 — Theft Crime Master Distinction Chart + Q#877, Q#1569
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-theft-classification",
    drill_type: "charge_picker",
    title: "The 5 Theft Crimes: Classification Drill",
    subject: "Criminal Law",
    instruction:
      "Pick the correct theft crime for each fact pattern. The distinctions turn on consent, possession vs. title, and whether fraud involved a past/present fact vs. a future promise.",
    questions: [
      {
        id: "tc-q1",
        stem: "A woman asked to borrow her neighbor's car 'just for an hour,' but secretly intended to keep it permanently. She drove away and never returned.",
        choices: [
          { id: "a", text: "Larceny — she took property without consent" },
          { id: "b", text: "Larceny by trick — she obtained possession through fraud, not title" },
          { id: "c", text: "False pretenses — she deceived him to get the car" },
          { id: "d", text: "Embezzlement — she was entrusted with the car" },
        ],
        answer_id: "b",
        explanation:
          "Larceny by trick = consent to POSSESSION only, obtained through fraud. She got permission to take the car (consent to possess) but only through a lie about her intent. He never transferred ownership (title) — only temporary use. False pretenses requires the fraud to transfer title. Embezzlement requires initial lawful possession — but here the initial possession was tainted by fraud.",
      },
      {
        id: "tc-q2",
        stem: "A gallery owner transferred legal title to a painting to a buyer who falsely claimed to represent a major museum seeking pieces for a permanent collection. The buyer disappeared.",
        choices: [
          { id: "a", text: "Larceny by trick — possession was obtained through misrepresentation" },
          { id: "b", text: "False pretenses — title to the painting was transferred based on the fraud" },
          { id: "c", text: "Embezzlement — the buyer was entrusted with the painting" },
          { id: "d", text: "Larceny — the owner didn't truly consent" },
        ],
        answer_id: "b",
        explanation:
          "Q#1569 pattern. False pretenses = consent to TITLE obtained through fraud about a past or present fact. The gallery owner transferred OWNERSHIP (title) of the painting based on the false representation. Compare: if she only 'lent' the painting to show the museum = larceny by trick (possession only). Once title passes based on fraud = false pretenses.",
      },
      {
        id: "tc-q3",
        stem: "A lawyer placed client funds into her personal bank account and paid her mortgage with the money. The clients had authorized her to hold and manage funds on their behalf.",
        choices: [
          { id: "a", text: "Larceny — she took property that wasn't hers" },
          { id: "b", text: "Larceny by trick — clients were deceived into handing over money" },
          { id: "c", text: "Embezzlement — she lawfully held the funds and fraudulently converted them" },
          { id: "d", text: "False pretenses — she obtained the funds through deception" },
        ],
        answer_id: "c",
        explanation:
          "Embezzlement = lawfully had possession, then fraudulently converted. The lawyer had LEGITIMATE, authorized custody of the client funds — she didn't steal them through trickery. The crime is the CONVERSION (using them for herself), not the initial receipt. Key distinction: embezzlement starts with lawful possession; larceny/larceny-by-trick start with an unlawful taking or fraudulent acquisition.",
      },
      {
        id: "tc-q4",
        stem: "Marcus borrowed $500 from his coworker, genuinely intending to repay it. He gambled the money away and fled town. His coworker files a criminal complaint. What result?",
        choices: [
          { id: "a", text: "Larceny by trick — he obtained money through a false promise to repay" },
          { id: "b", text: "False pretenses — he misrepresented his intention to repay" },
          { id: "c", text: "Not guilty of any theft crime — a broken promise to repay is a civil debt" },
          { id: "d", text: "Embezzlement — he was entrusted with the money and converted it" },
        ],
        answer_id: "c",
        explanation:
          "Q#877 pattern. Both larceny by trick and false pretenses require fraud about an EXISTING FACT. A promise to repay that isn't kept is a FUTURE intention, not a false statement about the present. False pretenses specifically requires misrepresentation of a past or present fact — not a future promise. Since Marcus genuinely intended to repay at the time, there was no intent to permanently deprive at the moment of taking. Civil debt, not a crime.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 8: Burglary Traps (trap_spotter, 3 questions)
  // Sourced from: Part 3 — Burglary Full Trap List + Q#694
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-burglary-traps",
    drill_type: "trap_spotter",
    title: "Burglary Traps",
    subject: "Criminal Law",
    instruction:
      "Three classic burglary scenarios. Each has a trap answer that loses points. Identify the wrong answer and the rule that kills it.",
    questions: [
      {
        id: "bt-q1",
        stem: "A defendant broke into a farmhouse with intent to steal. The farmhouse had been vacant for three months while the owner was traveling. Common law jurisdiction. What is the trap answer?",
        choices: [
          { id: "a", text: "Guilty of burglary — he broke in with felonious intent" },
          { id: "b", text: "Not guilty of burglary — vacant buildings are not common law dwellings" },
          { id: "c", text: "Guilty of burglary — the owner's temporary absence doesn't change it" },
          { id: "d", text: "Not guilty of burglary — he didn't enter at nighttime" },
        ],
        answer_id: "a",
        explanation:
          "Choices A and C are traps. At common law, burglary requires a DWELLING — a place currently and regularly used for habitation. A building vacant for 3 months has lost its dwelling status. No dwelling = no burglary, regardless of the defendant's intent. Modern statutes and MPC have abandoned this requirement, but the question says common law. The defendant may be guilty of attempted larceny but not common law burglary.",
      },
      {
        id: "bt-q2",
        stem: "A thief entered a museum during regular business hours through an open front door. He had formed his intent to steal a painting before entering. He took the painting and was caught. Common law jurisdiction. What is the trap answer?",
        choices: [
          { id: "a", text: "Guilty of burglary — he had the intent to steal upon entry" },
          { id: "b", text: "Not guilty of burglary; guilty of larceny — he entered lawfully, no breaking" },
          { id: "c", text: "Guilty of burglary — entering through an open door can still be breaking" },
          { id: "d", text: "Not guilty of larceny — he entered with permission" },
        ],
        answer_id: "a",
        explanation:
          "Q#694 pattern. Burglary requires a BREAKING — any unauthorized entry. Entering during business hours through an open door = lawful, invited entry = NO breaking = no burglary. The defendant's criminal intent at the time of entry doesn't transform a lawful entry into a trespassory breaking. He's guilty of larceny (completed) but not burglary.",
      },
      {
        id: "bt-q3",
        stem: "A defendant was convicted of burglary after entering a neighbor's house at night with intent to steal. He found nothing worth taking and left empty-handed. The jury returned a verdict of 'guilty of burglary only.' What is missing?",
        choices: [
          { id: "a", text: "Nothing — burglary is complete upon entry with criminal intent" },
          { id: "b", text: "He should also be convicted of attempted larceny — burglary + attempted underlying felony go together" },
          { id: "c", text: "The verdict should say 'guilty of trespass' instead of burglary" },
          { id: "d", text: "He can't be convicted of larceny if he took nothing" },
        ],
        answer_id: "b",
        explanation:
          "'Only burglary' as a final verdict is almost always incomplete. When a defendant commits burglary but fails to complete the underlying felony, he is guilty of BOTH burglary AND attempted larceny (or attempted whatever felony was intended). The attempt to steal is a separate, standalone conviction. Burglary + attempted larceny = the standard package deal on the MBE.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 9: Accomplice Traps (trap_spotter, 3 questions)
  // Sourced from: Part 4 — Accomplice Liability + Q#1035, Q#849, Q#1072
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-accomplice-traps",
    drill_type: "trap_spotter",
    title: "Accomplice Traps",
    subject: "Criminal Law",
    instruction:
      "Three accomplice scenarios. One answer choice in each is the trap. Identify it and learn the rule.",
    questions: [
      {
        id: "act-q1",
        stem: "Eight gang members surrounded a rival. Their leader beat the rival to death. The other seven members watched but did nothing — no encouragement, no assistance. They are charged as accomplices to murder. What is the trap answer?",
        choices: [
          { id: "a", text: "Guilty as accomplices — they were present and knew what was happening" },
          { id: "b", text: "Not guilty — mere presence, even knowing presence, is never enough for accomplice liability" },
          { id: "c", text: "Guilty — their silence implied encouragement of the leader" },
          { id: "d", text: "Not guilty — they couldn't be convicted without being charged individually" },
        ],
        answer_id: "a",
        explanation:
          "Q#1035 pattern. Choices A and C are the traps. Accomplice liability requires (1) assistance or encouragement AND (2) PURPOSE that the crime be committed. Mere presence — even deliberate, knowing presence — is NEVER enough. Standing by is not assisting. Not objecting is not encouraging. Each bystander gang member must have actively aided the leader to be an accomplice.",
      },
      {
        id: "act-q2",
        stem: "A woman lied to police about a felon's whereabouts after learning he had committed armed robbery. The felon's trial is still pending. The DA charges the woman as accessory after the fact NOW. Defense argues she can't be convicted until the felon is convicted. What is the trap answer?",
        choices: [
          { id: "a", text: "Correct — accessory conviction must wait for the principal's conviction" },
          { id: "b", text: "Wrong — a principal need not be convicted before an accessory after the fact can be convicted" },
          { id: "c", text: "Correct — conviction of an accessory requires proof of the underlying felony at the principal's trial" },
          { id: "d", text: "Wrong — accessory liability is completely independent of the principal's outcome" },
        ],
        answer_id: "a",
        explanation:
          "Q#849 pattern. Choice A (and C) are the traps. Accessory liability is INDEPENDENT of the principal's prosecution or conviction. The woman's guilt turns on her OWN acts: she knew about the felony, she lied to police to help the felon escape prosecution. That's accessory after the fact regardless of whether the felon is ever tried or convicted. The principal's trial outcome is irrelevant.",
      },
      {
        id: "act-q3",
        stem: "Two men planned an armed bank robbery together. One entered the bank and shot a bystander during the robbery. The other waited in the getaway car outside and never entered. Is the getaway driver guilty of murder?",
        choices: [
          { id: "a", text: "No — the driver didn't shoot and had no intent to kill" },
          { id: "b", text: "Yes — a killing during armed robbery is a foreseeable consequence; both are guilty of murder" },
          { id: "c", text: "No — only the person who committed the physical act can be guilty of murder" },
          { id: "d", text: "Yes — but only under felony murder theory" },
        ],
        answer_id: "b",
        explanation:
          "Q#1072 pattern. Choice A is the classic trap. An accomplice is liable for the TARGET crime AND all FORESEEABLE crimes committed in furtherance. A shooting during an armed bank robbery is a foreseeable consequence — the whole point of 'armed' robbery is that guns can go off. The driver is guilty of murder under both felony murder (robbery = BARRK crime) and depraved heart theory. Both defendants are guilty.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 10: Defense Scenarios (charge_picker, 4 questions)
  // Sourced from: Part 5 — Defenses + Q#624, Q#700, Q#918, Q#861
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-defenses-scenarios",
    drill_type: "charge_picker",
    title: "Defense Scenarios",
    subject: "Criminal Law",
    instruction:
      "Each scenario involves a raised defense. Does the defense work? Apply the correct rule for each defense type.",
    questions: [
      {
        id: "ds-q1",
        stem: "A severely intoxicated man deliberately picks up a gun and shoots a stranger in the chest. He formed the intent to shoot in that moment. Majority jurisdiction on voluntary intoxication. What is the most serious provable charge?",
        choices: [
          { id: "a", text: "1st degree murder — deliberate shooting shows premeditation" },
          { id: "b", text: "2nd degree murder — intoxication may negate deliberation but not knowing he was killing" },
          { id: "c", text: "Voluntary manslaughter — intoxication reduces culpability" },
          { id: "d", text: "Not guilty — voluntary intoxication negates criminal liability" },
        ],
        answer_id: "b",
        explanation:
          "Q#1255 pattern. Majority rule: voluntary intoxication can negate the 'cool reflection' (premeditation) element of 1st degree murder, dropping it to 2nd degree. But 2nd degree murder requires only that the defendant KNEW he was causing death — a drunk person who deliberately aims and fires a gun at a person knows they're killing. Intoxication NEVER drops murder below 2nd degree.",
      },
      {
        id: "ds-q2",
        stem: "A teenage girl is charged with shoplifting (strict liability in this jurisdiction). She claims she genuinely thought the bracelet was a free sample left for customers. Does her mistake of fact negate liability?",
        choices: [
          { id: "a", text: "Yes — her honest belief negates the required mental state" },
          { id: "b", text: "Yes — if her belief was reasonable" },
          { id: "c", text: "No — mistake of fact is never a defense to strict liability crimes" },
          { id: "d", text: "Yes — she must be given the benefit of the doubt on intent" },
        ],
        answer_id: "c",
        explanation:
          "Mistake of fact works as a defense only when it negates the REQUIRED mental state. Strict liability crimes have no mental state to negate — that's the entire point. No matter how honest, genuine, or reasonable her mistake was, it's irrelevant. No mental state is required, so no mistake can negate it. Strict liability = the act itself is the crime.",
      },
      {
        id: "ds-q3",
        stem: "A defendant killed a stranger after being told at gunpoint that his family would be murdered unless he did so. He raises DURESS as a defense to first-degree murder. What result?",
        choices: [
          { id: "a", text: "Duress is a valid defense — the threat was immediate and credible" },
          { id: "b", text: "Duress reduces the charge to voluntary manslaughter" },
          { id: "c", text: "Duress is NEVER a defense to intentional murder — guilty of murder" },
          { id: "d", text: "Duress is valid if a reasonable person would have complied" },
        ],
        answer_id: "c",
        explanation:
          "Q#624 pattern — 26% chose duress wrongly. Duress is NEVER a defense to intentional murder. No threat, however immediate or credible — even to loved ones — legally excuses the intentional killing of an innocent person. This is an absolute rule with no exceptions. If you see duress or necessity offered as a defense to intentional murder on the MBE, eliminate it immediately.",
      },
      {
        id: "ds-q4",
        stem: "A father relied on his attorney's advice that taking his child on a road trip during a custody dispute was legally permissible. He is charged with kidnapping. His defense: his lawyer said it was legal. What result?",
        choices: [
          { id: "a", text: "Not guilty — good-faith reliance on attorney advice negates criminal intent" },
          { id: "b", text: "Not guilty — reasonable mistake of law is a defense" },
          { id: "c", text: "Guilty — attorney advice constitutes a mistake of law, which is almost never a defense" },
          { id: "d", text: "Not guilty — he acted in good faith and caused no harm" },
        ],
        answer_id: "c",
        explanation:
          "Q#861 pattern. Attorney advice that a course of action is legal = MISTAKE OF LAW, not mistake of fact. Mistake of law is almost never a defense — even when the mistake is reasonable and based on attorney advice. The rule: ignorance of the law is no excuse, and a lawyer's incorrect advice doesn't change the law. Choices A and B are both traps — good faith and reasonableness don't cure a mistake of law.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 11: Intoxication Traps (trap_spotter, 3 questions)
  // Sourced from: Part 5 — Voluntary Intoxication + Part 6 MPC rule + Q#918
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-intoxication-traps",
    drill_type: "trap_spotter",
    title: "Intoxication Traps",
    subject: "Criminal Law",
    instruction:
      "Voluntary intoxication is one of the most commonly misapplied defenses. Three scenarios — find the trap answer in each.",
    questions: [
      {
        id: "it-q1",
        stem: "A drunk driver sped 45 mph over the limit through a school zone, thinking he was being chased, and killed a pedestrian. He argues his intoxication prevented him from appreciating the risk his driving created. Recklessness-based manslaughter charge. What is the trap answer?",
        choices: [
          { id: "a", text: "Defense valid — if he couldn't appreciate the risk, he wasn't reckless" },
          { id: "b", text: "No defense — voluntary intoxication is never a defense to recklessness" },
          { id: "c", text: "No defense — the objective recklessness standard applies regardless of subjective awareness" },
          { id: "d", text: "No defense — voluntarily getting drunk is itself a reckless act" },
        ],
        answer_id: "a",
        explanation:
          "Q#918 pattern. Choice A is the trap. Voluntary intoxication is NEVER a defense to recklessness — full stop. The recklessness test is OBJECTIVE: would a sober person have recognized the risk? If yes (and racing 45 mph over the limit through a school zone obviously is), the defendant is reckless regardless of whether he personally appreciated it. Choosing to drink and drive is itself the reckless act.",
      },
      {
        id: "it-q2",
        stem: "In an MPC jurisdiction, a defendant is charged under a statute requiring that she 'knowingly' damage property. She was severely intoxicated and knocked over a valuable sculpture, claiming she didn't know she was causing damage. Should the court give a voluntary intoxication instruction?",
        choices: [
          { id: "a", text: "No — voluntary intoxication is never a defense under the MPC" },
          { id: "b", text: "Yes — MPC voluntary intoxication applies when the offense requires purposely or knowingly" },
          { id: "c", text: "No — property damage crimes are general intent" },
          { id: "d", text: "Yes — but only if she proves the intoxication directly caused the act" },
        ],
        answer_id: "b",
        explanation:
          "Under the MPC, voluntary intoxication IS a valid defense when the charged offense requires the defendant to act PURPOSELY or KNOWINGLY — and the intoxication actually negated that mental state. This is broader than the majority rule. 'Knowingly' is one of the two MPC mental states where intoxication matters. Choice A is the trap — the MPC does recognize intoxication for purposely/knowingly offenses.",
      },
      {
        id: "it-q3",
        stem: "A defendant charged with arson (statute requires 'malicious burning') argues he was so intoxicated he didn't appreciate the recklessness required for malice. What is the trap answer?",
        choices: [
          { id: "a", text: "Valid defense — malice is a specific intent element that intoxication can negate" },
          { id: "b", text: "No defense — voluntary intoxication does not apply to malice crimes like arson" },
          { id: "c", text: "No defense — arson is measured by an objective standard" },
          { id: "d", text: "No defense — he completed the act, so intoxication is irrelevant" },
        ],
        answer_id: "a",
        explanation:
          "Choice A is the trap. 'Malicious burning' in arson is a MALICE standard — reckless disregard of the high probability of burning — not a specific intent requirement. Malice crimes sit in the same category as recklessness: judged objectively, not by the defendant's personal subjective awareness. Voluntary intoxication cannot negate malice in arson, just as it cannot negate recklessness in manslaughter.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 12: Merger Traps (trap_spotter, 4 questions)
  // Sourced from: Part 6 — Merger Doctrine Chart + Conspiracy never merges
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-merger-traps",
    drill_type: "trap_spotter",
    title: "Merger Traps",
    subject: "Criminal Law",
    instruction:
      "Four merger scenarios. One answer in each is the trap. Identify it and learn the exception that matters most.",
    questions: [
      {
        id: "mt-q1",
        stem: "A defendant punched a victim and then took her wallet. He is convicted of both ROBBERY and BATTERY as separate crimes. What is the trap answer about these convictions?",
        choices: [
          { id: "a", text: "Both convictions are proper — they each have separate elements" },
          { id: "b", text: "Battery merges into robbery — the battery that constitutes the force element cannot be a separate conviction" },
          { id: "c", text: "Only battery stands — battery is the more specific crime" },
          { id: "d", text: "Both convictions are proper — robbery is a felony and battery is a misdemeanor" },
        ],
        answer_id: "a",
        explanation:
          "Choice A is the trap. Battery is a lesser included offense of robbery. The battery used to accomplish the robbery MERGES into the robbery conviction — you cannot be convicted of both robbery AND the battery that constituted the force element. Punishing both would punish the same conduct twice. 'Robbery AND battery' = almost always the wrong answer on the MBE.",
      },
      {
        id: "mt-q2",
        stem: "A defendant attacked a victim with a baseball bat, and the victim died. The prosecution charges felony murder, with 'assault with a deadly weapon' as the underlying felony. What is the trap answer?",
        choices: [
          { id: "a", text: "Guilty of felony murder — the assault occurred before and caused the death" },
          { id: "b", text: "Not guilty of felony murder — assault with a deadly weapon merges into the homicide and cannot serve as the predicate felony" },
          { id: "c", text: "Guilty — BARRK crimes aren't the only valid predicates" },
          { id: "d", text: "Not guilty — assault with a deadly weapon is not a felony" },
        ],
        answer_id: "a",
        explanation:
          "Q#682 and Q#1042 pattern. Choice A is the trap. The merger rule for felony murder: the underlying felony must be INDEPENDENT of the killing itself. Assault with a deadly weapon that DIRECTLY causes the death merges into the homicide — it cannot then be used as the 'felony' for felony murder. BARRK crimes work because they are genuinely independent of the killing (a burglary is complete before anyone dies).",
      },
      {
        id: "mt-q3",
        stem: "A defendant is convicted of conspiracy to commit robbery AND the completed robbery. He argues the conspiracy merged into the completed crime. What is the trap?",
        choices: [
          { id: "a", text: "Correct — the conspiracy merged into the completed robbery" },
          { id: "b", text: "Wrong — conspiracy NEVER merges into the completed crime; you can be convicted of both" },
          { id: "c", text: "Correct — under the MPC conspiracy always merges" },
          { id: "d", text: "Wrong — unless the conspiracy was abandoned before completion" },
        ],
        answer_id: "a",
        explanation:
          "Choice A is the trap. Conspiracy is the ONE major exception to merger. Conspiracy NEVER merges into the completed crime — not at common law, not under the MPC. A defendant can be convicted of BOTH conspiracy AND the target crime. This is the most commonly tested merger rule because test-takers assume merger applies universally. It doesn't. Conspiracy = always a separate, standalone conviction.",
      },
      {
        id: "mt-q4",
        stem: "A defendant was convicted of burglary but failed to steal anything from the house. The jury returned 'guilty of burglary only.' Which answer identifies the error?",
        choices: [
          { id: "a", text: "No error — burglary is a standalone crime, no additional conviction required" },
          { id: "b", text: "Error — he should also be convicted of attempted larceny; burglary + attempted larceny go together" },
          { id: "c", text: "Error — he should be acquitted of burglary since no property was taken" },
          { id: "d", text: "No error — you cannot convict of an attempt when the defendant left without the property" },
        ],
        answer_id: "b",
        explanation:
          "Choice A is the trap — 'only burglary' is almost always an incomplete verdict. When a defendant commits burglary but fails to complete the underlying felony (here: larceny), he is guilty of BOTH burglary AND attempted larceny. The attempt to commit the underlying felony is a separate, independent conviction. Burglary + attempted larceny = the standard package deal.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL 13: Final Answer Intelligence Sweep (trap_spotter, 4 questions)
  // Sourced from: Part 7 — Answer Choices to Eliminate Immediately (full sweep)
  // ─────────────────────────────────────────────────────────────────────────
  {
    drill_id: "d1-final-answer-intelligence",
    drill_type: "trap_spotter",
    title: "Final Answer Intelligence Sweep",
    subject: "Criminal Law",
    instruction:
      "A final sweep through the MBE's most reliable eliminate-on-sight answer patterns. For each question, identify the answer that should be eliminated immediately — before you even finish reading the fact pattern.",
    questions: [
      {
        id: "fai-q1",
        stem: "A defendant is charged with murder after fatally shooting someone during an argument. He is severely intoxicated. Which answer do you eliminate immediately without needing to analyze the facts?",
        choices: [
          { id: "a", text: "Not guilty of murder — he didn't intend to kill" },
          { id: "b", text: "Guilty of 2nd degree murder — intoxication negates deliberation but not the knowing act of shooting" },
          { id: "c", text: "Guilty of 1st degree if he premeditated, or 2nd degree if not" },
          { id: "d", text: "Guilty of depraved heart murder if he consciously disregarded a serious risk" },
        ],
        answer_id: "a",
        explanation:
          "Eliminate Choice A immediately — always. 'No intent to kill = no murder' is the single most reliable eliminate-on-sight pattern on the MBE. Intent to kill is only ONE of four malice theories. Intent to cause serious bodily harm, depraved heart recklessness, and felony murder all support murder without any intent to kill. Whenever you see this answer on a murder question, eliminate it before reading further.",
      },
      {
        id: "fai-q2",
        stem: "A defendant is charged with intentional first-degree murder. He claims he was acting under duress — someone threatened to kill his children unless he killed the victim. Which answer do you eliminate immediately?",
        choices: [
          { id: "a", text: "Not guilty — the threat was sufficiently immediate and the defendant had no reasonable alternative" },
          { id: "b", text: "Guilty — duress is never a defense to intentional murder" },
          { id: "c", text: "Guilty — the threatened harm to third parties does not create legally cognizable duress" },
          { id: "d", text: "Guilty — duress can reduce the charge but never excuse it entirely" },
        ],
        answer_id: "a",
        explanation:
          "Eliminate Choice A immediately. Duress and necessity are NEVER defenses to intentional murder — no exceptions, in any jurisdiction. No threat, however immediate or severe, legally excuses intentionally killing an innocent person. Q#624: 26% chose this wrong. When you see duress or necessity offered as a defense to intentional murder on any question, eliminate before reading the explanation.",
      },
      {
        id: "fai-q3",
        stem: "A defendant consciously fired his gun into a dense crowd at a festival. He killed someone. Which answer do you eliminate immediately?",
        choices: [
          { id: "a", text: "Guilty of involuntary manslaughter — he didn't target a specific victim" },
          { id: "b", text: "Guilty of depraved heart / 2nd degree murder — conscious disregard of extreme risk" },
          { id: "c", text: "Guilty of murder under implied malice" },
          { id: "d", text: "Guilty of murder — malice doesn't require intent to kill a specific person" },
        ],
        answer_id: "a",
        explanation:
          "Eliminate Choice A immediately. 'Involuntary manslaughter' when facts show CONSCIOUS DISREGARD of a high risk to human life = the #1 homicide degree error on the MBE. Consciously firing into a crowd = aware of the extreme risk + chose to ignore it = depraved heart MURDER (2nd degree). Involuntary manslaughter requires criminal negligence WITHOUT conscious disregard. Conscious awareness of the risk automatically elevates to murder.",
      },
      {
        id: "fai-q4",
        stem: "An accessory after the fact is charged before the principal's trial. The defense argues the case must be dismissed because the principal hasn't been convicted yet. Which answer do you eliminate?",
        choices: [
          { id: "a", text: "Correct — the principal must be convicted first before accessory liability attaches" },
          { id: "b", text: "Wrong — accessory liability is independent; principal conviction is not required" },
          { id: "c", text: "Wrong — accessory can be convicted before, during, or even if the principal is acquitted" },
          { id: "d", text: "Wrong — the prosecution need only prove the principal committed the felony, not that he was convicted" },
        ],
        answer_id: "a",
        explanation:
          "Eliminate Choice A immediately. 'The principal must be convicted first' is an almost-always-wrong answer choice for accessory after the fact questions. Q#849 pattern. Accessory liability is COMPLETELY INDEPENDENT — the accessory can be convicted before the principal's trial, after an acquittal, or in situations where the principal is never prosecuted. Spotting 'principal must be convicted first' = eliminate on contact.",
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

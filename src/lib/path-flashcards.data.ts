// J7 flashcard decks — content as code. Day-1 Criminal Law homicide deck (10 cards)
// derived from the Criminal Law master sheet (CrimLaw_MasterSheet.docx).
//
// These are DEFINITIONAL black-letter cards (term → rule), NOT test questions with
// engineered distractors, so they are classified non-gated (the founder chose to
// ship flashcards now). Recommend a quick legal-accuracy skim before go-live even
// so — the statements track common-law / MBE-majority rules.

export interface FlashCard {
  card_id: string;
  front: string;
  back: string;
}

export interface FlashcardDeck {
  deck_id: string;
  deck_title: string;
  subject: string;
  cards: FlashCard[];
}

const CRIMINAL_DAY1: FlashcardDeck = {
  deck_id: "criminal-law-day1",
  deck_title: "Criminal Law — Homicide Core",
  subject: "Criminal Law",
  cards: [
    {
      card_id: "c01",
      front: "Malice aforethought — the four mental states",
      back: "Any ONE establishes malice: (1) intent to kill; (2) intent to inflict serious bodily harm; (3) depraved-heart (reckless indifference to an unjustifiably high risk to human life); (4) intent to commit a felony (felony murder).",
    },
    {
      card_id: "c02",
      front: "Voluntary manslaughter — the formula",
      back: "An intentional killing in a sudden heat of passion on adequate provocation, before a reasonable cooling-off period. The provocation negates the malice that would otherwise make it murder.",
    },
    {
      card_id: "c03",
      front: "Adequate provocation — the four requirements",
      back: "(1) provocation that would inflame a reasonable person; (2) the defendant was in fact provoked; (3) not enough time to cool off; (4) the defendant did not in fact cool off.",
    },
    {
      card_id: "c04",
      front: "The cooling-time trap",
      back: "A meaningful gap between the provocation and the killing means a reasonable person would have cooled — so the killing is MURDER, not voluntary manslaughter. (Classic fact: provoked at work, kills the next day = cooled = murder.)",
    },
    {
      card_id: "c05",
      front: "Are words alone adequate provocation?",
      back: "At common law, words alone are almost never adequate provocation — no matter how insulting or informational.",
    },
    {
      card_id: "c06",
      front: "Depraved-heart (second-degree) murder",
      back: "An unintended killing caused by reckless indifference to an unjustifiably high risk to human life (e.g., firing a gun into an occupied room).",
    },
    {
      card_id: "c07",
      front: "Felony murder — the rule",
      back: "A killing — even accidental — committed during the commission or attempted commission of an inherently dangerous felony. Common list (BARRK): burglary, arson, robbery, rape, kidnapping.",
    },
    {
      card_id: "c08",
      front: "Involuntary manslaughter — two theories",
      back: "(1) criminal negligence — a grossly negligent killing; (2) misdemeanor-manslaughter — a killing during an unlawful act not amounting to a felony.",
    },
    {
      card_id: "c09",
      front: "First- vs second-degree murder",
      back: "First degree (statutory): premeditated and deliberate killing, or an enumerated felony murder. Second degree: the default murder — malice but no premeditation, including depraved-heart.",
    },
    {
      card_id: "c10",
      front: "Murder vs voluntary manslaughter — the dividing line",
      back: "Both are intentional killings. Manslaughter exists ONLY when adequate provocation + heat of passion negate malice. No qualifying provocation (or the defendant cooled off) = murder.",
    },
  ],
};

const DECKS: Record<string, FlashcardDeck> = {
  [CRIMINAL_DAY1.deck_id]: CRIMINAL_DAY1,
};

export function getFlashcardDeck(deckId: string): FlashcardDeck | null {
  return DECKS[deckId] ?? null;
}

/** Public shape for GET /api/flashcards/:deckId. */
export function shapeDeck(deck: FlashcardDeck): {
  deck_id: string;
  deck_title: string;
  subject: string;
  card_count: number;
  cards: FlashCard[];
} {
  return {
    deck_id: deck.deck_id,
    deck_title: deck.deck_title,
    subject: deck.subject,
    card_count: deck.cards.length,
    cards: deck.cards,
  };
}

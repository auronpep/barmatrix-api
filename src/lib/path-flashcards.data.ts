// J7 flashcard decks reset placeholder.

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

const DECKS: Record<string, FlashcardDeck> = {};

export function getFlashcardDeck(deckId: string): FlashcardDeck | null {
  return DECKS[deckId] ?? null;
}

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

/**
 * Vocabulary Word Domain Models
 */

export interface Word {
  id: string;               // UUID v4
  english: string;          // e.g. "ephemeral"
  urduMeaning: string;      // e.g. "عارضی / وقتی"
  partOfSpeech: string;     // e.g. "adjective"
  pronunciation: string;    // e.g. "ih-FEM-er-ul"
  exampleSentence: string;  // e.g. "Fame is ephemeral."
  category?: string;        // e.g. "Phrasal Verbs" | "Connectors & Phrases"
  isFavourite: boolean;     // user starred

  // SM-2 Spaced Repetition fields
  repetitions: number;      // count of consecutive recall successes
  easinessFactor: number;   // starts at 2.5
  intervalDays: number;     // days until next review
  nextReviewAt: string;     // ISO 8601 string

  // Metadata
  addedAt: string;
  updatedAt: string;
  syncedToCloud: boolean;
}

export type SwipeDirection = 'up' | 'down';

export interface SwipeSessionState {
  wordsDue: Word[];
  currentIndex: number;
  completedTodayCount: number;
  streak: number;
}

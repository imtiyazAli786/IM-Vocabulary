/**
 * User Sentence Domain Models & Categories
 */

export interface SentenceCategoryMeta {
  id: string;
  title: string;
  category?: string;
  subCategory?: string;
  formula?: string;
  ruleSummary?: string;
  icon?: string;
}

export const SENTENCE_CATEGORIES: SentenceCategoryMeta[] = [
  {
    id: 'all',
    title: 'All',
    icon: 'layers-outline',
  },
  {
    id: 'simple-present-wh',
    title: 'Simple Present (WH-Questions)',
    category: 'Simple Present',
    subCategory: 'WH-Questions',
    formula: 'WH-word + do/does + subject + base verb?',
    ruleSummary: 'Use do with I, you, we, they • Use does with he, she, it',
    icon: 'help-circle-outline',
  },
];

export interface UserSentence {
  id: string;               // UUID v4 or sent-id
  english: string;          // English sentence
  urduMeaning: string;      // AI or seeded authentic Urdu translation
  isTranslating?: boolean;

  // Category & Grammar metadata (Rule 2 backwards-compatible)
  category?: string;        // e.g. "Simple Present", "Past Tense", "Modals", "Passive Voice"
  subCategory?: string;     // e.g. "WH-Questions"
  targetWord?: string;      // e.g. "What", "Where", "When", "Why", "Who", "Whom", "Whose", "Which", "How", etc.
  grammarPattern?: string;  // e.g. "WH-word + do/does + subject + base verb?"

  // Optional SM-2 fields for swipe practice mode
  repetitions?: number;
  easinessFactor?: number;
  intervalDays?: number;
  nextReviewAt?: string;

  addedAt: string;
  updatedAt: string;
  syncedToCloud: boolean;
}

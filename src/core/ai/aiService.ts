/**
 * AI Service Contract & Types
 * Every LLM provider (Gemini, Claude, OpenAI, Local) MUST implement this interface.
 * UI components only talk to this abstraction.
 */

export interface WordEnrichment {
  urduMeaning: string;      // Meaning in Urdu script, e.g. "عارضی / وقتی"
  partOfSpeech: string;     // e.g. "adjective", "noun", "verb"
  pronunciation: string;    // Phonetic spelling e.g. "ih-FEM-er-ul"
  exampleSentence: string;  // Contextual natural sentence
}

export interface AIService {
  /**
   * Enriches an English word with Urdu translation, POS, pronunciation, and an example sentence.
   */
  enrichWord(word: string): Promise<WordEnrichment>;

  /**
   * Translates an arbitrary English sentence to natural, context-aware Urdu.
   */
  translateSentence(sentence: string): Promise<string>;
}

export class AIServiceError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'AIServiceError';
  }
}

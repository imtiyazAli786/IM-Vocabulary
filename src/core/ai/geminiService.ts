/**
 * Google Gemini AI Service Implementation
 * Calls Gemini 1.5/2.0 Flash REST API directly with structured output prompting.
 * Zero heavy SDK baggage, identical behavior on iOS, Android, and Web.
 */

import { AIService, AIServiceError, WordEnrichment } from './aiService';
import { MockAIService } from './mockAIService';

export class GeminiAIService implements AIService {
  private apiKey: string;
  private fallbackService = new MockAIService();

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
      '';
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  async enrichWord(word: string): Promise<WordEnrichment> {
    const cleanWord = word.trim();
    if (!cleanWord) {
      throw new AIServiceError('Word cannot be empty.');
    }

    // If no API key configured, use instant mock service
    if (!this.hasApiKey()) {
      return this.fallbackService.enrichWord(cleanWord);
    }

    const prompt = `You are a vocabulary assistant for an English-Urdu learning app.
Given the English word "${cleanWord}", output ONLY a valid JSON object without markdown code blocks, backticks, or preamble:
{
  "urdu_meaning": "<concise Urdu script translation, e.g. عارضی / وقتی>",
  "part_of_speech": "<noun|verb|adjective|adverb|preposition|etc>",
  "pronunciation": "<simple phonetic spelling, e.g. ih-FEM-er-ul>",
  "example_sentence": "<one short, memorable English sentence using the word>"
}`;

    try {
      const response = await this.callGemini(prompt);
      const parsed = this.cleanAndParseJSON<WordEnrichment>(response);

      if (!parsed.urduMeaning || !parsed.partOfSpeech) {
        throw new Error('Malformed AI response schema');
      }

      return {
        urduMeaning: parsed.urduMeaning,
        partOfSpeech: parsed.partOfSpeech.toLowerCase(),
        pronunciation: parsed.pronunciation || cleanWord.toLowerCase(),
        exampleSentence: parsed.exampleSentence || `Example for ${cleanWord}.`,
      };
    } catch (err) {
      console.warn(`[GeminiAIService] Falling back to offline dictionary for "${cleanWord}":`, err);
      return this.fallbackService.enrichWord(cleanWord);
    }
  }

  async translateSentence(sentence: string): Promise<string> {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) {
      throw new AIServiceError('Sentence cannot be empty.');
    }

    if (!this.hasApiKey()) {
      return this.fallbackService.translateSentence(cleanSentence);
    }

    const prompt = `Translate the following English sentence into natural, idiomatic Urdu script. Output ONLY the Urdu text with no English, no transliteration, and no quotes:
"${cleanSentence}"`;

    try {
      const result = await this.callGemini(prompt);
      return result.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      console.warn('[GeminiAIService] Falling back to offline translation:', err);
      return this.fallbackService.translateSentence(cleanSentence);
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    // We try gemini-1.5-flash which is fast, lightweight, and high quality for Urdu
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey.trim()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AIServiceError(`Gemini API error [${res.status}]: ${errorText}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new AIServiceError('No candidate text returned by Gemini API.');
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  private cleanAndParseJSON<T>(raw: string): T {
    // Strip markdown formatting like ```json ... ```
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }
    // Match first JSON object { ... }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      cleaned = match[0];
    }
    const parsed = JSON.parse(cleaned);

    // Map snake_case to camelCase if returned
    return {
      urduMeaning: parsed.urduMeaning || parsed.urdu_meaning || '',
      partOfSpeech: parsed.partOfSpeech || parsed.part_of_speech || '',
      pronunciation: parsed.pronunciation || '',
      exampleSentence: parsed.exampleSentence || parsed.example_sentence || '',
    } as unknown as T;
  }
}

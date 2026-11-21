/**
 * AI Service Factory
 * To switch the active AI model across the entire app,
 * simply change ACTIVE_PROVIDER or call setAIService().
 */

import { AIService } from './aiService';
import { GeminiAIService } from './geminiService';
import { MockAIService } from './mockAIService';

export type AIProviderType = 'gemini' | 'mock' | 'custom';

// Set your default provider here (Offline by default)
export let ACTIVE_PROVIDER: AIProviderType = 'mock';

let activeInstance: AIService | null = null;
const geminiInstance = new GeminiAIService();
const mockInstance = new MockAIService();

/**
 * Returns the currently active AI Service instance.
 */
export function getAIService(): AIService {
  if (activeInstance) {
    return activeInstance;
  }

  switch (ACTIVE_PROVIDER) {
    case 'gemini':
      return geminiInstance;
    case 'mock':
    default:
      return mockInstance;
  }
}

/**
 * Switch the active provider at runtime.
 */
export function setActiveAIProvider(provider: AIProviderType): void {
  ACTIVE_PROVIDER = provider;
  activeInstance = null;
}

/**
 * Inject a custom AIService (e.g., for Claude, OpenAI, or testing).
 */
export function setCustomAIService(service: AIService): void {
  activeInstance = service;
}

/**
 * Update the Gemini API key at runtime (e.g. from a settings screen).
 */
export function setGeminiApiKey(apiKey: string): void {
  geminiInstance.setApiKey(apiKey);
}

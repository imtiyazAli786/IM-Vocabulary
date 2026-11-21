/**
 * AI Service Contract Tests
 */

import { MockAIService } from './mockAIService';
import { getAIService, setActiveAIProvider } from './aiFactory';

describe('AI Service Layer', () => {
  const service = new MockAIService();

  test('Enriches known dictionary phrasal verb with authentic Urdu translation', async () => {
    const res = await service.enrichWord('give up');
    expect(res.urduMeaning).toContain('ہار مان لینا');
    expect(res.partOfSpeech).toBe('phrasal verb');
    expect(res.pronunciation).toBeTruthy();
    expect(res.exampleSentence).toContain('give up');
  });

  test('Translates English sentence to Urdu', async () => {
    const translation = await service.translateSentence('The meeting was postponed');
    expect(translation).toContain('ملتوی');
  });

  test('Enriches seeded collocation from offline dictionary', async () => {
    const res = await service.enrichWord('make a decision');
    expect(res.urduMeaning).toContain('فیصلہ کرنا');
    expect(res.partOfSpeech).toBe('collocation');
  });

  test('Translates seeded WH-question sentence completely offline', async () => {
    const translation = await service.translateSentence('what do you do every day');
    expect(translation).toContain('آپ ہر روز کیا کرتے ہیں');
  });

  test('Provides offline morphology heuristics for unknown words', async () => {
    const adverbRes = await service.enrichWord('relentlessly');
    expect(adverbRes.partOfSpeech).toBe('adverb');

    const nounRes = await service.enrichWord('resilience');
    expect(nounRes.partOfSpeech).toBe('noun');
  });

  test('aiFactory switches provider cleanly', () => {
    setActiveAIProvider('mock');
    const ai = getAIService();
    expect(ai).toBeDefined();
    expect(typeof ai.enrichWord).toBe('function');
  });
});

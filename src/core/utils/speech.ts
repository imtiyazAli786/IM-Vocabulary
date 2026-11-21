/**
 * Audio Speech Synthesis (TTS) Helper
 * Pronounces English vocabulary words cleanly across iOS, Android, and Web.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export async function speakEnglish(word: string): Promise<void> {
  if (!word || typeof word !== 'string') return;

  // Clean slash or dash separated items (e.g., pronouns/homophones) so TTS pauses naturally instead of saying "slash"
  const spokenText = word.replace(/\s*—\s*/g, ' ').replace(/\s*\/\s*/g, ', ').trim();

  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }

    Speech.speak(spokenText, {
      language: 'en-US',
      pitch: 1.0,
      rate: Platform.select({ ios: 0.9, android: 0.85, default: 0.95 }),
      voice: undefined, // Uses native best voice
    });
  } catch (err) {
    // Graceful fallback for web browsers without SpeechSynthesis permission
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Silently ignore browser voice restrictions
      }
    }
  }
}

export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Ignore
  }
}

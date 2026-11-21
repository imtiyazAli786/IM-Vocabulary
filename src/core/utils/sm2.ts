/**
 * SuperMemo SM-2 Spaced Repetition Algorithm
 * Pure TypeScript implementation with zero external dependencies.
 */

export interface SM2Input {
  repetitions: number;
  easinessFactor: number;
  intervalDays: number;
}

export interface SM2Output {
  repetitions: number;
  easinessFactor: number;
  intervalDays: number;
  nextReviewAt: string; // ISO 8601 string
}

/**
 * Calculates next review parameters based on recall quality.
 *
 * @param current Current SM-2 state
 * @param quality Recall quality: 0 (blackout) to 5 (flawless recall)
 *                Swipe UP maps to 5 (Mastered/Known)
 *                Swipe DOWN maps to 2 (Review Again)
 */
export function calculateSM2(current: SM2Input, quality: number): SM2Output {
  // Clamp quality between 0 and 5
  const q = Math.max(0, Math.min(5, quality));

  // 1. Calculate new Easiness Factor (EF)
  let newEF = current.easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  // EF cannot drop below 1.3
  newEF = Math.max(1.3, Number(newEF.toFixed(2)));

  let newRepetitions: number;
  let newInterval: number;

  // 2. Calculate interval and repetition count
  if (q < 3) {
    // Failed recall — reset to step 1
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Successful recall
    newRepetitions = current.repetitions + 1;
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(current.intervalDays * newEF);
    }
  }

  // 3. Compute next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  // Set to start of day for cleaner scheduling
  nextDate.setHours(0, 0, 0, 0);

  return {
    repetitions: newRepetitions,
    easinessFactor: newEF,
    intervalDays: newInterval,
    nextReviewAt: nextDate.toISOString(),
  };
}

/**
 * Checks whether a card is currently due for review.
 */
export function isCardDue(nextReviewAt?: string | null): boolean {
  if (!nextReviewAt) return true; // Brand new card
  const dueDate = new Date(nextReviewAt);
  const now = new Date();
  return now.getTime() >= dueDate.getTime();
}

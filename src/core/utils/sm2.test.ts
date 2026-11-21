/**
 * SM-2 Algorithm Tests
 */

import { calculateSM2, isCardDue } from './sm2';

describe('SM-2 Spaced Repetition Algorithm', () => {
  test('First successful recall sets repetition to 1 and interval to 1 day', () => {
    const result = calculateSM2(
      { repetitions: 0, easinessFactor: 2.5, intervalDays: 1 },
      5 // Flawless recall (Swipe UP)
    );

    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.easinessFactor).toBeGreaterThanOrEqual(2.5);
    expect(new Date(result.nextReviewAt).getTime()).toBeGreaterThan(Date.now() - 10000);
  });

  test('Second successful recall sets repetition to 2 and interval to 6 days', () => {
    const result = calculateSM2(
      { repetitions: 1, easinessFactor: 2.6, intervalDays: 1 },
      5
    );

    expect(result.repetitions).toBe(2);
    expect(result.intervalDays).toBe(6);
  });

  test('Third successful recall multiplies interval by easiness factor', () => {
    const result = calculateSM2(
      { repetitions: 2, easinessFactor: 2.5, intervalDays: 6 },
      4 // Good recall
    );

    expect(result.repetitions).toBe(3);
    expect(result.intervalDays).toBe(Math.round(6 * result.easinessFactor));
  });

  test('Failed recall (Swipe DOWN) resets repetitions to 0 and interval to 1', () => {
    const result = calculateSM2(
      { repetitions: 4, easinessFactor: 2.7, intervalDays: 24 },
      2 // Failed / Show again (Swipe DOWN)
    );

    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
  });

  test('Easiness factor never drops below minimum threshold of 1.3', () => {
    let state = { repetitions: 0, easinessFactor: 1.4, intervalDays: 1 };
    for (let i = 0; i < 5; i++) {
      state = calculateSM2(state, 0);
    }
    expect(state.easinessFactor).toBe(1.3);
  });

  test('isCardDue accurately checks dates', () => {
    expect(isCardDue(null)).toBe(true);
    expect(isCardDue(undefined)).toBe(true);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    expect(isCardDue(pastDate.toISOString())).toBe(true);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    expect(isCardDue(futureDate.toISOString())).toBe(false);
  });
});

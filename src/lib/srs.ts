// SM-2 spaced repetition algorithm
export type Rating = "again" | "hard" | "good" | "easy";

export interface SRSState {
  ease: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  mastered: boolean;
}

export function applyRating(prev: SRSState, rating: Rating): SRSState {
  let { ease, interval_days, repetitions } = prev;
  const q = rating === "again" ? 0 : rating === "hard" ? 3 : rating === "good" ? 4 : 5;

  if (q < 3) {
    repetitions = 0;
    interval_days = 0; // due again today (~10 min)
  } else {
    repetitions += 1;
    if (repetitions === 1) interval_days = 1;
    else if (repetitions === 2) interval_days = 3;
    else interval_days = Math.max(1, Math.round(interval_days * ease));
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }

  const dueDate = new Date();
  if (interval_days === 0) {
    dueDate.setMinutes(dueDate.getMinutes() + 10);
  } else {
    dueDate.setDate(dueDate.getDate() + interval_days);
  }

  return {
    ease: Number(ease.toFixed(2)),
    interval_days,
    repetitions,
    due_at: dueDate.toISOString(),
    mastered: repetitions >= 5 && interval_days >= 21,
  };
}

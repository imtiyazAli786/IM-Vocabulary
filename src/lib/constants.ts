// Shared vocabulary type colour map used across words list, detail, practice, and import pages.
export const TYPE_COLORS: Record<string, string> = {
  word: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  phrase: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  connector: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  idiom: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  tense_pattern: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

/** Converts DB type slugs to a human-readable label, e.g. "tense_pattern" → "tense pattern" */
export function formatType(type: string): string {
  return type.replaceAll("_", " ");
}

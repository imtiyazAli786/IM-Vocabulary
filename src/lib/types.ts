/** Result returned by the checkSentence server function. Shared by word detail and practice pages. */
export interface CheckResult {
  valid: boolean;
  corrected_sentence: string;
  errors: Array<{
    type: string;
    explanation: string;
    fix: string;
  }>;
  alternative_suggestions: string[];
  feedback: string;
}

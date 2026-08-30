import { toast } from "sonner";

/**
 * Speaks the given text using the Web Speech API.
 * Falls back to a toast error if speech synthesis is unavailable.
 */
export function speak(text: string, lang = "en-US"): void {
  if (typeof window === "undefined" || !text || !text.trim()) return;
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.trim());
      u.lang = lang;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  } else {
    toast.error("Speech synthesis not supported in this browser");
  }
}

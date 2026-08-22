import { toast } from "sonner";

/**
 * Speaks the given text using the Web Speech API.
 * Falls back to a toast error if speech synthesis is unavailable.
 */
export function speak(text: string, lang = "en-US"): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  } else {
    toast.error("Speech synthesis not supported in this browser");
  }
}

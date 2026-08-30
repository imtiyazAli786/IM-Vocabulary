// Persistent reference to prevent WebKit/Blink GC bug
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudio: HTMLAudioElement | null = null;

/**
 * Speaks the given text using the Web Speech API with automatic voice detection
 * and fallback to high-quality audio pronunciation.
 */
export function speak(text: string, lang = "en-US"): void {
  if (typeof window === "undefined" || !text || !text.trim()) return;

  const cleanText = text.trim().replace(/^["']|["']$/g, "");

  // Stop any active audio
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  // Attempt Web Speech API first
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      const synth = window.speechSynthesis;

      // Fix Chrome stuck in paused state
      if (synth.paused) {
        synth.resume();
      }

      synth.cancel();

      const u = new SpeechSynthesisUtterance(cleanText);
      u.lang = lang;
      u.rate = 0.92;
      u.pitch = 1.0;
      u.volume = 1.0;

      // Auto-select preferred natural English/system voice
      const voices = synth.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice =
          voices.find(
            (v) =>
              v.lang.startsWith("en") &&
              (v.name.includes("Natural") ||
                v.name.includes("Google") ||
                v.name.includes("Samantha") ||
                v.name.includes("Daniel") ||
                v.name.includes("Siri") ||
                v.name.includes("Premium"))
          ) ||
          voices.find((v) => v.lang.startsWith("en") || v.lang.startsWith("en-US")) ||
          voices[0];

        if (preferredVoice) {
          u.voice = preferredVoice;
        }
      }

      // Keep reference to prevent garbage collection bug
      activeUtterance = u;

      let hasEnded = false;
      u.onend = () => {
        hasEnded = true;
        activeUtterance = null;
      };

      u.onerror = (err) => {
        console.warn("Web Speech API error, falling back to audio:", err);
        activeUtterance = null;
        if (!hasEnded) {
          playAudioFallback(cleanText, lang);
        }
      };

      // Slight timeout prevents cancel/speak race conditions in Chromium/WebKit
      setTimeout(() => {
        synth.speak(u);
      }, 15);

      return;
    } catch (e) {
      console.warn("SpeechSynthesis failed, trying audio fallback:", e);
    }
  }

  // Fallback to audio stream
  playAudioFallback(cleanText, lang);
}

function playAudioFallback(text: string, lang = "en-US") {
  try {
    const langCode = lang.startsWith("ur") ? "ur" : "en";
    const encoded = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${langCode}&client=tw-ob`;
    
    const audio = new Audio(url);
    activeAudio = audio;
    audio.play().catch((err) => {
      console.warn("Audio fallback playback error:", err);
    });
  } catch (err) {
    console.warn("Audio fallback initialization failed:", err);
  }
}


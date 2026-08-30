export function getAiConfig() {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    (globalThis as any).GEMINI_API_KEY ||
    process.env.LOVABLE_API_KEY ||
    (globalThis as any).LOVABLE_API_KEY;

  if (!apiKey) {
    throw new Error("AI service is unavailable. Please add GEMINI_API_KEY to enable AI features.");
  }

  // Direct Google Gemini API uses "gemini-2.5-flash-lite" for maximum quota and ultra-fast response
  // Lovable gateway uses "google/gemini-2.5-flash"
  const isGeminiDirect = !!(process.env.GEMINI_API_KEY || (globalThis as any).GEMINI_API_KEY);
  const url = isGeminiDirect
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const model = isGeminiDirect ? "gemini-2.5-flash-lite" : "google/gemini-2.5-flash";

  return { apiKey, url, model };
}





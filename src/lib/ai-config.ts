export function getAiConfig(
  customKey?: string,
  customProvider?: "nvidia" | "openrouter" | "gemini",
  customModel?: string
) {
  // 1. If custom key is passed directly from client/settings
  if (customKey && customKey.trim()) {
    const key = customKey.trim();
    const isOpenRouter = customProvider === "openrouter" || key.startsWith("sk-or-");
    const isNvidia = customProvider === "nvidia" || key.startsWith("nvapi-");

    if (isOpenRouter) {
      return {
        provider: "openrouter",
        apiKey: key,
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: customModel?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
      };
    }

    if (isNvidia) {
      return {
        provider: "nvidia",
        apiKey: key,
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        model: customModel?.trim() || "nvidia/llama-3.1-nemotron-70b-instruct",
      };
    }

    return {
      provider: "gemini",
      apiKey: key,
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: customModel?.trim() || "gemini-2.5-flash-lite",
    };
  }

  // 2. Check for NVIDIA Nemotron API Key in environment
  const nvidiaKey =
    process.env.NVIDIA_API_KEY ||
    (globalThis as any).NVIDIA_API_KEY ||
    process.env.NEMOTRON_API_KEY ||
    (globalThis as any).NEMOTRON_API_KEY;

  if (nvidiaKey && nvidiaKey.trim()) {
    const model =
      process.env.NVIDIA_MODEL ||
      (globalThis as any).NVIDIA_MODEL ||
      "nvidia/llama-3.1-nemotron-70b-instruct";
    return {
      provider: "nvidia",
      apiKey: nvidiaKey.trim(),
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      model,
    };
  }

  // 3. Check for Google Gemini API Key in environment
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    (globalThis as any).GEMINI_API_KEY ||
    process.env.LOVABLE_API_KEY ||
    (globalThis as any).LOVABLE_API_KEY;

  if (geminiKey && geminiKey.trim()) {
    const isGeminiDirect = !!(process.env.GEMINI_API_KEY || (globalThis as any).GEMINI_API_KEY);
    const url = isGeminiDirect
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const model = isGeminiDirect ? "gemini-2.5-flash-lite" : "google/gemini-2.5-flash";
    return {
      provider: "gemini",
      apiKey: geminiKey.trim(),
      url,
      model,
    };
  }

  throw new Error("AI service is unavailable. Please add NVIDIA_API_KEY or GEMINI_API_KEY to enable AI features.");
}




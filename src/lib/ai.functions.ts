import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAiConfig } from "@/lib/ai-config";

const Input = z.object({
  word: z.string().min(1).max(120),
});

const SYSTEM = `You are an expert bilingual English-Urdu vocabulary and language teacher.
Your highest priority is to provide Urdu translations that are CRYSTAL CLEAR, ACCURATE, NATURAL, and EXTREMELY EASY TO UNDERSTAND for everyday learners (انتہائی آسان، عام فہم اور روزمرہ بول چال کی اردو).

CRITICAL SENSE SELECTION & ACCURACY RULES:
1. PRIMARY MODERN REAL-WORLD USAGE SENSE:
   - Always choose the MOST COMMON, PREVALENT REAL-WORLD CONVERSATIONAL & WORKPLACE SENSE in modern everyday English.
   - Disambiguate multiple dictionary meanings by choosing the sense people actually use in daily work and life:
     * "reassignment" → assigning a new role, duty, or task ("نئی ذمہ داری" / "نیا کام"), NOT geographical transfer ("تبادلہ").
     * "overwhelm" → feeling overloaded/swamped by work, stress, or emotions ("پریشان کرنا" / "دباؤ ڈالنا" / "حاوی ہونا"), NEVER battlefield defeat ("ہرا دینا").
     * "render" → to make/cause to become ("بنا دینا" / "کر دینا").
     * "dismiss" → reject an idea or remove from job ("رد کرنا" / "فارغ کرنا").
     * "address" → deal with an issue/problem ("توجہ دینا" / "حل کرنا").
     * "compromise" → settle a difference ("سمجھوتہ کرنا").
2. 100% UNIFIED SENSE CONSISTENCY:
   - "definition_en", "translation_ur", "one_word_en", "one_word_ur", "synonym", and "antonym" MUST ALL REFLECT THE EXACT SAME MEANING SENSE.
   - Do NOT mix different dictionary senses across fields.
3. SIMPLE CONVERSATIONAL URDU (عام فہم اردو):
   - Use simple words that any native Urdu speaker, beginner, or student understands immediately.
   - STRICTLY AVOID heavy, archaic, academic, literary, or Persian/Arabic-heavy vocabulary.
   - ❌ AVOID: "استفسار", "معاونت", "مسرت", "تحیر", "مستعد", "استقامت", "ادراک", "تنازعہ", "کوششِ بسیار", "محسوس" (for tangible), "سریع", "اجتناب", "تخفیف", "مغلوبیت"
   - ✅ USE: "پوچھنا", "مدد", "خوشی", "حیرانی", "تیار", "مضبوط رہنا", "سمجھنا", "جھگڑا", "بڑی کوشش", "ٹھوس", "تیز", "رکنا / باز رہنا", "کم کرنا", "پریشان کرنا", "شامل کرنا", "نئی ذمہ داری"
4. NATURAL CONCISE URDU EQUIVALENT (one_word_ur):
   - Provide the most concise, natural everyday Urdu equivalent (1 to 2 words max, e.g. "نئی ذمہ داری", "باسی", "مضبوط", "کم کرنا", "شامل کرنا", "نیا کام").
   - Prefer natural conversational accuracy (e.g. "نئی ذمہ داری" for reassignment) rather than forcing an unnatural single word (like "تبادلہ").
5. URDU DEFINITION (translation_ur):
   - A short, crystal-clear explanation in 1 conversational Urdu sentence (max 15 words).

SITUATION CATEGORY & USAGE SPECTRUM:
1. CATEGORY CLASSIFICATION: Classify into exactly ONE of 3 permanent situation categories:
   - "daily-life" (Home, family conversations, friends, casual chat, phrasal verbs, e.g. "put off", "hang out", "chill", "wiped out")
   - "workplace" (Office environment, team meetings, workplace discussions, professional emails, e.g. "delay", "follow up", "deadline", "align")
   - "news-reading" (Newspaper articles, serious writing, editorials, essays, e.g. "postpone", "commence", "inquire", "resilient")
2. USAGE SPECTRUM: Provide the corresponding equivalent for ALL 3 situations:
   - informal: the daily-life / home / friends / casual equivalent (phrasal verb or casual term)
   - neutral: the workplace / office / standard daily equivalent (single word)
   - formal: the news-reading / formal newspaper equivalent (single word)

Given an English word, return ONLY compact JSON with these keys:
- category: "daily-life" | "workplace" | "news-reading"
- informal: spoken / home / friends / reality-show equivalent
- neutral: office / workplace / standard everyday equivalent
- formal: newspaper / editorial / formal equivalent
- part_of_speech: noun, verb, adjective, adverb, phrase, etc.
- one_word_en: a SINGLE common English word or concise phrase that means the same.
- one_word_ur: concise, natural everyday Urdu equivalent (1 to 2 words in Urdu script, e.g. "نئی ذمہ داری", "باسی", "مضبوط", "کم کرنا").
- synonym: ONE common English synonym.
- antonym: ONE common English antonym.
- definition_en: a simple, clear definition in plain English.
- translation_ur: a SIMPLE, clear, everyday Urdu meaning in ONE short sentence (max 15 words).
- tags: array of 1 to 2 permanent situation tags (e.g. ["daily-life"] or ["workplace"] or ["news-reading"]).
- collocations: array of 2 to 3 natural spoken collocations/phrases commonly used in daily conversation.
- example_en: primary daily-life or workplace conversation sentence (max 18 words). Wrap the headword in quotes.
- example_ur: the primary example translated into SHORT, VERY SIMPLE, natural spoken Urdu in Urdu script.
- examples: array of 2 to 3 objects where EVERY single object MUST have BOTH "en" (English sentence) AND "ur" (simple spoken Urdu translation in Urdu script):
  [
    {"en": "She gave a clear explanation.", "ur": "اس نے صاف اور واضح بات سمجھائی۔"},
    {"en": "Keep the message brief and clear.", "ur": "پیغام کو مختصر اور واضح رکھیں۔"}
  ]

No prose, no markdown fences, no extra keys.`;

export function normalizeExampleList(
  rawExamples: any,
  primaryEn?: string,
  primaryUr?: string
): Array<{ en: string; ur: string }> {
  const result: Array<{ en: string; ur: string }> = [];

  if (Array.isArray(rawExamples)) {
    for (const item of rawExamples) {
      if (!item) continue;
      if (typeof item === "string") {
        if (item.trim()) {
          result.push({ en: item.trim(), ur: "" });
        }
      } else if (typeof item === "object") {
        const en =
          item.en ||
          item.english ||
          item.sentence ||
          item.sentence_en ||
          item.example ||
          item.example_en ||
          item.text ||
          "";
        const ur =
          item.ur ||
          item.urdu ||
          item.translation ||
          item.translation_ur ||
          item.sentence_ur ||
          item.example_ur ||
          item.meaning ||
          "";
        if (en || ur) {
          result.push({ en: String(en).trim(), ur: String(ur).trim() });
        }
      }
    }
  }

  // If primary example pair was provided and not in result, add or attach
  if (result.length === 0 && (primaryEn || primaryUr)) {
    result.push({ en: (primaryEn || "").trim(), ur: (primaryUr || "").trim() });
  } else if (result.length > 0 && primaryUr && !result[0].ur) {
    result[0].ur = primaryUr.trim();
  }

  return result;
}

export const enrichWord = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { apiKey, url, model: defaultModel } = getAiConfig();
    const isGeminiDirect = url.includes("generativelanguage.googleapis.com");

    const fallbackModels = isGeminiDirect
      ? [defaultModel, "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"]
      : [defaultModel, "google/gemini-2.0-flash", "google/gemini-1.5-flash", "google/gemini-2.5-flash"];

    const uniqueModels = Array.from(new Set(fallbackModels.filter(Boolean)));
    let lastError: Error | null = null;

    for (const model of uniqueModels) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: `Word: ${data.word}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.warn(`Model ${model} returned error ${res.status}: ${text.slice(0, 200)}`);
          continue;
        }

        const j = await res.json();
        const content = j.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content);
        if (parsed && (parsed.one_word_ur || parsed.translation_ur || parsed.definition_en)) {
          const normalizedExamples = normalizeExampleList(
            parsed.examples,
            parsed.example_en,
            parsed.example_ur
          );

          return {
            ...parsed,
            example_en: parsed.example_en || normalizedExamples[0]?.en || "",
            example_ur: parsed.example_ur || normalizedExamples[0]?.ur || "",
            examples: normalizedExamples,
          } as {
            category?: "daily-life" | "workplace" | "news-reading";
            register?: "daily-life" | "workplace" | "news-reading" | "formal" | "neutral" | "informal";
            informal?: string;
            neutral?: string;
            formal?: string;
            formal_equivalent?: string;
            neutral_equivalent?: string;
            spoken_equivalent?: string;
            part_of_speech?: string;
            one_word_en?: string;
            one_word_ur?: string;
            synonym?: string;
            antonym?: string;
            definition_en?: string;
            translation_ur?: string;
            example_en?: string;
            example_ur?: string;
            tags?: string[];
            collocations?: string[];
            examples?: Array<{ en: string; ur?: string }>;
          };
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error("Failed to fetch word details. Please try again.");
  });

const UrduOnlyInput = z.object({
  word: z.string().min(1).max(120),
  definition_en: z.string().optional(),
  examples_en: z.array(z.string()).optional(),
});

const URDU_ONLY_SYSTEM = `You are an expert English-to-Urdu bilingual language teacher.
Your highest priority is to provide VERY SIMPLE, NATURAL, EVERYDAY CONVERSATIONAL URDU (انتہائی آسان اور عام فہم اردو).

RULES:
1. CONCISE 1-WORD URDU (one_word_ur):
   - 1 to 2 words in Urdu script only (e.g. "باسی", "مضبوط", "کم کرنا", "شامل کرنا", "نئی ذمہ داری").
   - AVOID archaic/literary terms.
2. URDU TRANSLATION (translation_ur):
   - Short, crystal clear Urdu meaning in 1 conversational sentence (max 15 words).
3. EXAMPLE TRANSLATIONS:
   - For any provided English example sentences, translate them into natural, simple spoken Urdu.
   - If no examples provided, provide 1 practical conversational example with simple Urdu translation.

Return ONLY compact JSON:
{
  "one_word_ur": "concise urdu word(s)",
  "translation_ur": "simple urdu sentence",
  "examples": [
    {"en": "...", "ur": "simple spoken urdu translation"}
  ]
}
`;

export const regenerateUrduOnly = createServerFn({ method: "POST" })
  .validator((d: unknown) => UrduOnlyInput.parse(d))
  .handler(async ({ data }) => {
    const { apiKey, url, model: defaultModel } = getAiConfig();
    const isGeminiDirect = url.includes("generativelanguage.googleapis.com");

    let userPrompt = `Word: "${data.word}"`;
    if (data.definition_en) {
      userPrompt += `\nEnglish Meaning: "${data.definition_en}"`;
    }
    if (data.examples_en && data.examples_en.length > 0) {
      userPrompt += `\nExample Sentences to translate:\n${data.examples_en.map((ex, i) => `${i + 1}. ${ex}`).join("\n")}`;
    }

    const fallbackModels = isGeminiDirect
      ? [defaultModel, "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"]
      : [defaultModel, "google/gemini-2.0-flash", "google/gemini-1.5-flash", "google/gemini-2.5-flash"];

    const uniqueModels = Array.from(new Set(fallbackModels.filter(Boolean)));
    let lastError: Error | null = null;

    for (const model of uniqueModels) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: URDU_ONLY_SYSTEM },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          console.warn(`Model ${model} returned error in regenerateUrduOnly: ${err.slice(0, 200)}`);
          continue;
        }

        const j = await res.json();
        const content = j.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content);
        if (parsed && (parsed.one_word_ur || parsed.translation_ur)) {
          const normalizedExamples = normalizeExampleList(
            parsed.examples,
            parsed.example_en,
            parsed.example_ur
          );

          return {
            ...parsed,
            examples: normalizedExamples,
          } as {
            one_word_ur?: string;
            translation_ur?: string;
            examples?: Array<{ en: string; ur: string }>;
          };
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error("Failed to generate Urdu translation. Please try again.");
  });

const FormalityBatchInput = z.object({
  words: z.array(
    z.object({
      id: z.string(),
      word: z.string(),
    }),
  ),
});

const FORMALITY_BATCH_SYSTEM = `You are an expert bilingual vocabulary analyzer.
Classify each English word into one of 3 Permanent Situation Categories and provide its 3-tier Spectrum:
- category: "daily-life" (Home, Friends, Shows) | "workplace" (Office, Meetings, Professional) | "news-reading" (Newspaper Articles, Formal Writing)
- informal: daily-life / friends / reality-show / phrasal verb equivalent
- neutral: workplace / office / standard equivalent
- formal: newspaper / editorial / formal equivalent

Return ONLY a JSON object:
{"results": [{"id": "<id>", "category": "daily-life"|"workplace"|"news-reading", "formal": "...", "neutral": "...", "informal": "..."}]}
`;

export const classifyAndEnrichFormalityBatch = createServerFn({ method: "POST" })
  .validator((d: unknown) => FormalityBatchInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.words || data.words.length === 0) {
      return { results: [] };
    }

    const { apiKey, url, model } = getAiConfig();
    const wordList = data.words.map((w, idx) => `${idx + 1}. [ID: ${w.id}] Word: "${w.word}"`).join("\n");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: FORMALITY_BATCH_SYSTEM },
          { role: "user", content: `Analyze the situation categories for these words:\n\n${wordList}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`AI formality batch error: ${res.status} ${err.slice(0, 300)}`);
      throw new Error("Failed to classify situation category batch.");
    }

    const j = await res.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      const results = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.results)
        ? parsed.results
        : Array.isArray(parsed.words)
        ? parsed.words
        : [];
      return {
        results: results as Array<{
          id: string;
          category?: "daily-life" | "workplace" | "news-reading";
          register?: "formal" | "neutral" | "informal" | "daily-life" | "workplace" | "news-reading";
          formal: string;
          neutral: string;
          informal: string;
        }>,
      };
    } catch {
      return { results: [] };
    }
  });

const BatchInput = z.object({
  sentences: z.array(
    z.object({
      id: z.string(),
      word: z.string().optional(),
      en: z.string(),
    }),
  ),
});

const BATCH_SYSTEM = `You are an expert English-to-Urdu translator.
Your task is to translate English sentences into VERY SIMPLE, NATURAL, EVERYDAY CONVERSATIONAL URDU (انتہائی آسان اور عام فہم اردو).

RULES:
1. Use only simple words that everyday people, beginners, and children understand easily.
2. STRICTLY DO NOT use difficult, heavy, archaic, or formal Persian/Arabic vocabulary.
3. Make the sentence flow smoothly and naturally in spoken Urdu (روانی اور درست محاورے کے ساتھ).
4. Return ONLY a JSON object in this exact format:
   {"translations": [{"id": "<id>", "ur": "<simple urdu translation>"}]}
`;

export const simplifySentencesBatch = createServerFn({ method: "POST" })
  .validator((d: unknown) => BatchInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.sentences || data.sentences.length === 0) {
      return { translations: [] };
    }

    const { apiKey, url, model } = getAiConfig();

    const formattedList = data.sentences
      .map((s, idx) => `${idx + 1}. [ID: ${s.id}] (${s.word ? `Word: ${s.word}` : ""}) English: "${s.en}"`)
      .join("\n");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: BATCH_SYSTEM },
          { role: "user", content: `Translate these sentences to simple, easy-to-understand Urdu:\n\n${formattedList}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`AI batch translation error: ${res.status} ${err.slice(0, 300)}`);
      throw new Error("Failed to simplify Urdu translations. Please try again.");
    }

    const j = await res.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.translations)
        ? parsed.translations
        : Array.isArray(parsed.sentences)
        ? parsed.sentences
        : [];
      return { translations: list as Array<{ id: string; ur: string }> };
    } catch {
      return { translations: [] };
    }
  });

const TestInput = z.object({
  key: z.string().min(5),
  provider: z.enum(["nvidia", "openrouter", "gemini"]),
  model: z.string().optional(),
});

export const testAiKey = createServerFn({ method: "POST" })
  .validator((d: unknown) => TestInput.parse(d))
  .handler(async ({ data }) => {
    const { apiKey, url, model } = getAiConfig();
    const provider = data.provider;

    const start = Date.now();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: "Reply with ONLY the word: Connected" },
        ],
        temperature: 0.2,
        max_tokens: 32,
      }),
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const err = await res.text();
      let errorDetail = err;
      try {
        const parsed = JSON.parse(err);
        if (parsed.detail) errorDetail = parsed.detail;
        else if (parsed.message) errorDetail = parsed.message;
        else if (parsed.error?.message) errorDetail = parsed.error.message;
      } catch {
        // use raw text
      }

      if (res.status === 403) {
        throw new Error(
          `NVIDIA API Key 403 (Forbidden): The key is invalid, expired, or has no remaining credits on build.nvidia.com. Please generate a new key at https://build.nvidia.com.`
        );
      }
      throw new Error(`Connection failed (${res.status}): ${errorDetail.slice(0, 150)}`);
    }

    const j = await res.json();
    return {
      success: true,
      provider,
      model,
      latencyMs: elapsed,
      response: j.choices?.[0]?.message?.content,
    };
  });


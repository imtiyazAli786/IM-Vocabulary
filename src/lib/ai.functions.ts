import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAiConfig } from "@/lib/ai-config";

const Input = z.object({
  word: z.string().min(1).max(120),
});

const SYSTEM = `You are an expert bilingual English-Urdu vocabulary and language teacher.
Your highest priority is to provide Urdu translations that are CRYSTAL CLEAR, NATURAL, and EXTREMELY EASY TO UNDERSTAND for everyday learners.

CRITICAL SITUATION CATEGORY & USAGE RULES:
1. CATEGORY CLASSIFICATION: Classify the input word into exactly ONE of 3 permanent situation categories:
   - "daily-life" (Home, family conversations, friends, reality shows, casual chat, phrasal verbs, e.g. "put off", "hang out", "chill", "wiped out")
   - "workplace" (Office environment, team meetings, workplace discussions, professional emails, e.g. "delay", "follow up", "deadline", "align")
   - "news-reading" (Newspaper articles, serious writing, editorials, essays, e.g. "postpone", "commence", "inquire", "resilient")
2. USAGE SPECTRUM: Provide the corresponding equivalent for ALL 3 situations:
   - informal: the daily-life / home / friends / reality-show equivalent (phrasal verb or casual term)
   - neutral: the workplace / office / standard daily equivalent (single word)
   - formal: the news-reading / formal newspaper equivalent (single word)
3. SIMPLE URDU: Use simple, common, conversational Urdu (عام فہم اور روزمرہ کی آسان اردو).
4. STRICTLY AVOID difficult, heavy, archaic, literary, Persianized words (e.g., do NOT use "استفسار", "معاونت", "مسرت", "تحیر", "مستعد", "استقامت", "ادراک"). INSTEAD use simple words: "پوچھنا", "مدد", "خوشی", "حیرانی", "تیار", "مضبوط رہنا", "سمجھنا".

Given an English word, return ONLY compact JSON with these keys:
- category: "daily-life" | "workplace" | "news-reading"
- informal: spoken / home / friends / reality-show equivalent
- neutral: office / workplace / standard everyday equivalent
- formal: newspaper / editorial / formal equivalent
- part_of_speech: noun, verb, adjective, adverb, phrase, etc.
- one_word_en: a SINGLE common English word that means the same (just one word).
- one_word_ur: a SINGLE VERY SIMPLE, everyday Urdu word (one word in Urdu script).
- synonym: ONE common English synonym.
- antonym: ONE common English antonym.
- definition_en: a simple, clear definition in plain English.
- translation_ur: a SIMPLE, clear, everyday Urdu meaning in ONE short sentence (max 15 words).
- tags: an array of 1 to 2 permanent situation tags (e.g. ["daily-life"] or ["workplace"] or ["news-reading"]).
- collocations: an array of 2 to 3 natural spoken collocations/phrases commonly used in daily conversation.
- example_en: primary daily-life or workplace conversation sentence (max 18 words). Wrap the headword in quotes.
- example_ur: the primary example translated into SHORT, VERY SIMPLE, natural spoken Urdu.
- examples: an array of 2 to 3 distinct practical conversational example sentences with VERY SIMPLE spoken Urdu translations.

No prose, no markdown fences, no extra keys.`;

export const enrichWord = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { apiKey, url, model } = getAiConfig();

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
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`AI gateway error ${res.status}: ${text.slice(0, 500)}`);
      throw new Error("Failed to fetch word details. Please try again.");
    }
    const j = await res.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(content) as {
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
    } catch {
      return {};
    }
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
  provider: z.enum(["nvidia", "gemini"]),
});

export const testAiKey = createServerFn({ method: "POST" })
  .validator((d: unknown) => TestInput.parse(d))
  .handler(async ({ data }) => {
    const { apiKey, url, model, provider } = getAiConfig(data.key, data.provider);

    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a bilingual translator. Return ONLY a JSON object: {\"status\": \"ok\", \"sample\": \"مضبوط\"}" },
          { role: "user", content: "Test query: resilient" },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Connection failed (${res.status}): ${err.slice(0, 200)}`);
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


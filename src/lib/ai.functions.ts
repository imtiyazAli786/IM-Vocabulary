import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAiConfig } from "@/lib/ai-config";

const Input = z.object({
  word: z.string().min(1).max(120),
});

const SYSTEM = `You are an expert bilingual English-Urdu vocabulary and language teacher.
Your highest priority is to provide Urdu translations that are CRYSTAL CLEAR, NATURAL, and EXTREMELY EASY TO UNDERSTAND for everyday learners.

CRITICAL URDU TRANSLATION RULES:
1. Use simple, common, conversational Urdu (عام فہم اور روزمرہ کی آسان اردو) that any beginner or child understands immediately.
2. STRICTLY AVOID difficult, heavy, archaic, literary, Persianized or Arabicized words.
   - For example, do NOT use "استفسار", "معاونت", "مسرت", "تحیر", "مستعد", "استقامت", "ادراک", "آغاز", "سہل".
   - INSTEAD use simple words: "پوچھنا", "مدد", "خوشی", "حیرانی", "تیار", "ڈٹے رہنا / ہمت نہ ہارنا", "سمجھنا", "شروع کرنا", "آسان".
3. For sentences: Translate the full sentence into natural, idiomatic, and simple everyday Urdu. Do NOT do awkward literal or word-for-word translations. The Urdu sentence should sound like natural spoken Urdu.

Given an English word, return ONLY compact JSON with these keys:
- part_of_speech: noun, verb, adjective, adverb, phrase, etc.
- one_word_en: a SINGLE common English word that means the same (just one word, no phrase). Example for "resilient": "tough".
- one_word_ur: a SINGLE VERY SIMPLE, everyday Urdu word that a beginner or child would instantly understand (just one word in Urdu script). Example for "resilient": "مضبوط".
- synonym: ONE common English synonym (single word).
- antonym: ONE common English antonym (single word).
- definition_en: a MERRIAM-WEBSTER STYLE English definition. Concise, precise lexicographic phrasing.
- translation_ur: a SIMPLE, clear, everyday Urdu meaning in ONE short sentence (max 15 words).
- tags: an array of 2 to 3 lowercase category tags (e.g. ["academic", "daily", "business", "emotions", "technology", "nature", "idioms", "formal"]).
- collocations: an array of 2 to 3 common prepositions/phrases/collocations with this word.
- example_en: primary natural usage example sentence (max 18 words). Wrap the headword in quotes.
- example_ur: the primary example translated into SHORT, VERY SIMPLE, natural everyday Urdu.
- examples: an array of 2 to 3 distinct contextual example sentences with VERY SIMPLE, easy-to-understand Urdu translations, e.g. [{"en": "She stayed resilient during the storm.", "ur": "طوفان کے دوران وہ مضبوط رہی اور گھبرائی نہیں۔"}, {"en": "The team made a resilient comeback.", "ur": "ٹیم نے شاندار اور مضبوط واپسی کی۔"}]

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

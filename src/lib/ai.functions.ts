import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAiConfig } from "@/lib/ai-config";

const Input = z.object({
  word: z.string().min(1).max(120),
});

const SYSTEM = `You are a bilingual English-Urdu vocabulary assistant for learners.

Given an English word, return ONLY compact JSON with these keys:
- part_of_speech
- one_word_en: a SINGLE common English word that means the same (just one word, no phrase). Example for "resilient": "tough".
- one_word_ur: a SINGLE VERY SIMPLE, everyday Urdu word that a beginner or child would instantly understand (just one word in Urdu script). MUST be common spoken Urdu — NOT literary, NOT Arabic/Persian-heavy, NOT formal.
- synonym: ONE common English synonym (single word).
- antonym: ONE common English antonym (single word).
- definition_en: a MERRIAM-WEBSTER STYLE English definition. Concise, precise lexicographic phrasing.
- translation_ur: a SIMPLE, everyday Urdu meaning in ONE short sentence (max 15 words).
- tags: an array of 2 to 3 lowercase category tags (e.g. ["academic", "daily", "business", "emotions", "technology", "nature", "idioms", "formal"]).
- collocations: an array of 2 to 3 common prepositions/phrases/collocations with this word (e.g. ["resilient to", "highly resilient", "remain resilient"]).
- example_en: primary natural usage example sentence (max 18 words). Wrap the headword in quotes.
- example_ur: the primary example translated into short, simple everyday Urdu.
- examples: an array of 2 to 3 distinct contextual example sentences with Urdu translations, e.g. [{"en": "He proved to be resilient during difficult times.", "ur": "وہ مشکل وقت میں بھی ثابت قدم رہا۔"}, {"en": "The economy showed a resilient recovery.", "ur": "معیشت نے مضبوط بحالی دکھائی۔"}]

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

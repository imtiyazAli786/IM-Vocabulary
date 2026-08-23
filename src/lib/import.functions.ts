import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAiConfig } from "@/lib/ai-config";
import fs from "fs";
import path from "path";

const Input = z.object({
  text: z.string().min(1).max(50000),
});

const SYSTEM = `You are an expert bilingual English-Urdu vocabulary extraction assistant for learners.
Your highest priority is to extract vocabulary entries and ensure ALL Urdu translations and sentence examples are in VERY SIMPLE, NATURAL, EVERYDAY CONVERSATIONAL URDU (انتہائی آسان اور عام فہم اردو).

CRITICAL URDU & CONVERSATIONAL RULES:
1. DAILY LIFE & SPOKEN FOCUS: Extract or generate practical, spoken, everyday conversational example sentences (like dialogues in reality shows, news discussions, and interpersonal daily chats).
2. STRICTLY AVOID difficult, heavy, archaic, literary, or Persian/Arabic-heavy words (e.g. do not use "استفسار", "معاونت", "مسرت", "تحیر", "مستعد", "استقامت", "ادراک").
3. Use common everyday words (e.g. "پوچھنا", "مدد", "خوشی", "حیرانی", "تیار", "مضبوط رہنا", "سمجھنا").
4. Make all sentence translations natural and flowing in spoken Urdu, not rigid literal word-for-word.

Given raw text from a user's vocabulary document, extract every vocabulary word/entry and return ONLY a JSON object in the exact format {"entries": [...]}. Each entry object must have these keys (use empty string if missing):
- word: the English word
- part_of_speech: noun, verb, adjective, etc.
- one_word_en: a SINGLE common English word with the same meaning (one word only)
- one_word_ur: a SINGLE VERY SIMPLE, everyday Urdu word (one word in Urdu script).
- synonym: ONE common English synonym (single word)
- antonym: ONE common English antonym (single word)
- definition_en: a simple, clear definition in plain English.
- translation_ur: a SIMPLE, clear, everyday Urdu meaning in ONE short sentence (max 15 words).
- example_en: a practical spoken/conversational example sentence. Wrap the headword in quotes.
- example_ur: the example translated into VERY SIMPLE, natural spoken Urdu (max 14 words).
- notes: any extra context or conversational notes

Return ONLY valid JSON matching {"entries": [...]}. Infer missing fields when possible.`;

export const parseVocabularyDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { apiKey, url } = getAiConfig();
    const fallbackModels = [
      "gemini-2.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-2.5-flash",
    ];

    let lastError: Error | null = null;

    for (const model of fallbackModels) {
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
              { role: "user", content: `Extract vocabulary from this document text:\n\n${data.text.slice(0, 12000)}` },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`Model ${model} failed (${res.status}): ${errText.slice(0, 200)}`);
          lastError = new Error(`AI model ${model} error: ${res.status}`);
          continue; // Try next model
        }

        const j = await res.json();
        let content = j.choices?.[0]?.message?.content ?? "{\"entries\":[]}";
        content = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();

        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.entries)
          ? parsed.entries
          : Array.isArray(parsed.words)
          ? parsed.words
          : Array.isArray(parsed.vocabulary)
          ? parsed.vocabulary
          : [];

        if (list.length > 0) {
          return { entries: list };
        }
      } catch (err) {
        console.warn(`Error trying model ${model}:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // Fallback: If AI endpoints hit rate limits, extract plain word list line-by-line
    const lines = data.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("===") && !l.startsWith("#"));

    if (lines.length > 0) {
      const basicEntries = lines
        .map((line) => {
          const clean = line.replace(/^\d+[\.\)\-]\s*/, "").trim();
          const parts = clean.split(/\s*[-–—:]\s*/);
          const word = parts[0]?.trim();
          const rest = parts.slice(1).join(" - ").trim();
          const hasUrdu = /[\u0600-\u06FF]/.test(rest);

          return {
            word,
            part_of_speech: "",
            definition_en: !hasUrdu && rest ? rest : "",
            translation_ur: hasUrdu ? rest : "",
            example_en: "",
            example_ur: "",
          };
        })
        .filter((e) => e.word && e.word.length < 50);

      if (basicEntries.length > 0) {
        return { entries: basicEntries };
      }
    }

    throw lastError || new Error("Failed to parse vocabulary. Please try again in a moment.");
  });

interface CSVRow {
  front: string;
  explanation: string;
}

// Simple CSV parser
function parseCSV(content: string): CSVRow[] {
  const rows: CSVRow[] = [];
  let currentField = '';
  let inQuotes = false;
  let currentRow: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      if (currentRow.length >= 4) {
        rows.push({
          front: currentRow[2].trim(),
          explanation: currentRow.slice(3).join(',').trim(),
        });
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length >= 4) {
      rows.push({
        front: currentRow[2].trim(),
        explanation: currentRow.slice(3).join(',').trim(),
      });
    }
  }

  // Remove header row if present
  if (rows.length > 0 && rows[0].front === 'front') {
    rows.shift();
  }

  return rows;
}

function parseTwoColumnCSV(content: string): CSVRow[] {
  const lines = content.split(/\r?\n/);
  const rows: CSVRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length >= 2) {
      const front = parts[0].trim();
      const explanation = parts.slice(1).join(',').trim();
      if (front !== 'Word' && front !== 'front') {
        rows.push({
          front,
          explanation
        });
      }
    }
  }
  return rows;
}

function classifyType(front: string, explanation: string): 'word' | 'phrase' | 'connector' | 'idiom' | 'tense_pattern' {
  const text = front.toLowerCase().trim();
  
  const tenseKeywords = [
    'i have been', 'i had been', 'i will have', 'i would have', 'i should have', 'i am doing', 'i was doing',
    'you have been', 'he has been', 'she has been', 'they have been', 'we have been',
    'have been doing', 'had been doing', 'will have done', 'would have done'
  ];
  if (tenseKeywords.some(kw => text.includes(kw))) {
    return 'tense_pattern';
  }

  const connectorWords = [
    'however', 'nevertheless', 'nonetheless', 'although', 'even so', 'despite', 'in spite of',
    'by contrast', 'on the other hand', 'furthermore', 'moreover', 'consequently', 'therefore',
    'on the contrary', 'in contrast', 'as a result', 'in addition', 'besides', 'alternatively'
  ];
  if (connectorWords.some(kw => text === kw || text.startsWith(kw + ',') || text.startsWith(kw + ' '))) {
    return 'connector';
  }

  const idiomPhrases = [
    'beating around the bush', 'beat around the bush', 'once in a blue moon', 'come what may',
    'never say die', 'cost an arm and a leg', 'piece of cake', 'break a leg', 'spill the beans',
    'let the cat out of the bag', 'bite the bullet', 'hit the nail on the head', 'burn the midnight oil',
    'under the weather', 'cry over spilled milk'
  ];
  if (idiomPhrases.some(id => text.includes(id))) {
    return 'idiom';
  }

  const cleanFront = front.replace(/[^a-zA-Z\s]/g, '').trim();
  const words = cleanFront.split(/\s+/);
  if (words.length > 1) {
    return 'phrase';
  }
  return 'word';
}

export const getLocalCSVEntries = createServerFn({ method: "GET" })
  .handler(async () => {
    const basePath = process.env.FLASHCARD_CSV_PATH || path.join(process.cwd(), "FlashCard/im v");
    const files = [
      { name: "backup_vocab.csv", type: "two-column" },
      { name: "vocabulary_backup.csv", type: "four-column" },
      { name: "vocabulary_shortcut.csv", type: "four-column" },
    ];

    const allEntries: Array<{
      word: string;
      type: 'word' | 'phrase' | 'connector' | 'idiom' | 'tense_pattern';
      translation_ur: string | null;
      definition_en: string | null;
      notes: string | null;
    }> = [];

    for (const f of files) {
      const filePath = path.join(basePath, f.name);
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        continue;
      }
      const content = fs.readFileSync(filePath, "utf-8");
      const rows = f.type === "two-column" ? parseTwoColumnCSV(content) : parseCSV(content);

      for (const row of rows) {
        const front = row.front.trim();
        const explanation = row.explanation.trim();
        if (!front) continue;

        // Skip instructions or noise rows from shortcut CSV header
        if (front.startsWith('/') || front.includes('Vocabulary can be easily') || front.includes('In the name of Allah') || front.includes('Contact:') || front.includes('Imtiyaz Ali') || front.includes('To find any word')) {
          continue;
        }

        const type = classifyType(front, explanation);
        const hasUrdu = /[\u0600-\u06FF]/.test(explanation);
        
        let translation_ur: string | null = null;
        let definition_en: string | null = null;

        if (hasUrdu) {
          translation_ur = explanation;
        } else {
          definition_en = explanation;
        }

        // Clean up formatting
        allEntries.push({
          word: front,
          type,
          translation_ur,
          definition_en,
          notes: `Imported from local file: ${f.name}`,
        });
      }
    }

    // Deduplicate by word
    const seen = new Set<string>();
    const uniqueEntries = allEntries.filter((entry) => {
      const key = `${entry.word.toLowerCase()}_${entry.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { entries: uniqueEntries };
  });


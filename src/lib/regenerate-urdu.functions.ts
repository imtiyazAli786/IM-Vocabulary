import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiConfig } from "@/lib/ai-config";

const SYSTEM = `You translate English words to ONE simple, everyday Urdu word.
Return ONLY compact JSON: {"ur":"<single urdu word>"}.
Rules:
1. Must be VERY SIMPLE, common spoken Urdu that a beginner or child instantly understands (عام فہم اور روزمرہ بول چال).
2. STRICTLY AVOID literary, archaic, formal, or Arabic/Persian-heavy words.
3. Single word (or max 2-word phrase like "کم کرنا" / "شامل کرنا" / "باز رہنا") in Urdu script only.
Examples:
- stale → باسی (not پرانا/بوسیدہ)
- refrain → رکنا (not اجتناب)
- resilient → مضبوط (not مستحکم)
- mitigate → کم کرنا (not تخفیف)
- concrete → ٹھوس (not محسوس)
- happy → خوش (not مسرور)
- inquire → پوچھنا (not استفسار)
- commence → شروع کرنا (not آغاز)
- assist → مدد کرنا (not معاونت)
- onboard → شامل کرنا (not تعینات)`;

async function fetchOne(word: string, apiKey: string, url: string, model: string): Promise<string | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Word: ${word}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  try {
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    const ur = (parsed?.ur ?? "").toString().trim();
    return ur || null;
  } catch {
    return null;
  }
}

export const regenerateAllUrduOneWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: any) => {
    const { apiKey, url, model } = getAiConfig();
    const supabase = context?.supabase;
    const userId = context?.userId;

    if (!userId || !supabase) {
      throw new Error("Requires sign-in");
    }

    const { data: words, error } = await supabase
      .from("words")
      .select("id, word")
      .eq("user_id", userId);
    if (error) throw error;
    if (!words || words.length === 0) return { updated: 0, failed: 0, total: 0 };

    let updated = 0;
    let failed = 0;
    const CONCURRENCY = 5;
    for (let i = 0; i < words.length; i += CONCURRENCY) {
      const chunk = words.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (w: { id: string; word: string }) => {
          const ur = await fetchOne(w.word, apiKey, url, model);
          if (!ur) { failed++; return; }
          const { error: upErr } = await supabase
            .from("words")
            .update({ one_word_ur: ur })
            .eq("id", w.id);
          if (upErr) failed++; else updated++;
        })
      );
    }
    return { updated, failed, total: words.length };
  });

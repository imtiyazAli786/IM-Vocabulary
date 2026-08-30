import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { enrichWord } from "@/lib/ai.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wand2, ArrowLeft, Save, Plus, Trash2, Tag, BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { toast } from "sonner";

const addWordSearchSchema = z.object({
  word: z.string().optional().catch(""),
  ur: z.string().optional().catch(""),
  def: z.string().optional().catch(""),
  example: z.string().optional().catch(""),
  exampleUr: z.string().optional().catch(""),
  tag: z.string().optional().catch("daily-life"),
});

export const Route = createFileRoute("/_app/words/add")({
  validateSearch: (search) => addWordSearchSchema.parse(search),
  component: AddWordPage,
  head: () => ({ meta: [{ title: "Add entry — Lafz" }] }),
});

interface ExamplePair {
  en: string;
  ur: string;
}

function AddWordPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const searchParams = Route.useSearch();
  const enrich = useServerFn(enrichWord);

  const [form, setForm] = useState({
    word: searchParams?.word || "",
    type: "word" as "word" | "phrase" | "connector" | "idiom" | "tense_pattern",
    category: (searchParams?.tag === "daily" ? "daily-life" : (searchParams?.tag as any)) || "daily-life",
    part_of_speech: "",
    one_word_en: "",
    one_word_ur: "",
    synonym: "",
    antonym: "",
    definition_en: searchParams?.def || "",
    translation_ur: searchParams?.ur || "",
    notes: "",
    collocationsInput: "",
  });

  const [examples, setExamples] = useState<ExamplePair[]>([
    { en: searchParams?.example || "", ur: searchParams?.exampleUr || "" }
  ]);

  const [spectrumBridge, setSpectrumBridge] = useState({
    formal: "",
    neutral: "",
    informal: "",
  });

  const [busy, setBusy] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const update =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const updateExample = (index: number, field: "en" | "ur", value: string) => {
    setExamples((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addExample = () => {
    if (examples.length >= 4) {
      toast.info("Maximum 4 example sentences");
      return;
    }
    setExamples((prev) => [...prev, { en: "", ur: "" }]);
  };

  const removeExample = (index: number) => {
    if (examples.length <= 1) {
      setExamples([{ en: "", ur: "" }]);
      return;
    }
    setExamples((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnrich = async () => {
    if (!form.word.trim()) {
      toast.error("Enter a word first");
      return;
    }
    setEnriching(true);
    try {
      const r = await enrich({ data: { word: form.word.trim() } });

      let inferredType = (r.type as any) || form.type || "word";
      if (form.type === "word" && form.word.trim().split(/\s+/).length > 1) {
        inferredType = "phrase";
      }

      const generatedCollocations =
        r.collocations && r.collocations.length > 0
          ? r.collocations.join(", ")
          : "";

      if (r.examples && r.examples.length > 0) {
        setExamples(
          r.examples.map((ex: { en: string; ur?: string }) => ({
            en: ex.en || "",
            ur: ex.ur || "",
          }))
        );
      } else if (r.example_en || r.example_ur) {
        setExamples([{ en: r.example_en || "", ur: r.example_ur || "" }]);
      } else {
        setExamples([{ en: "", ur: "" }]);
      }

      const detectedCat = r.category || (r.register === "formal" ? "news-reading" : r.register === "neutral" ? "workplace" : "daily-life");

      setSpectrumBridge({
        formal: r.formal || r.formal_equivalent || "",
        neutral: r.neutral || r.neutral_equivalent || "",
        informal: r.informal || r.spoken_equivalent || "",
      });

      // Clear any previous/stale values and overwrite completely with fresh AI answers
      setForm((f) => ({
        ...f,
        type: inferredType,
        category: detectedCat,
        part_of_speech: r.part_of_speech || "",
        one_word_en: r.one_word_en || "",
        one_word_ur: r.one_word_ur || "",
        synonym: r.synonym || "",
        antonym: r.antonym || "",
        definition_en: r.definition_en || "",
        translation_ur: r.translation_ur || "",
        collocationsInput: generatedCollocations,
      }));
      toast.success("Fresh AI answers populated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI fill failed");
    } finally {
      setEnriching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.word.trim()) return;
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");

      const parsedCollocations = form.collocationsInput
        .split(/[,،\n]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      const validExamples = examples.filter((ex) => ex.en.trim().length > 0);
      const primaryExample = validExamples[0] || { en: "", ur: "" };

      const spectrumMeta = JSON.stringify({
        category: form.category,
        formal: spectrumBridge.formal || (form.category === "news-reading" ? form.word.trim() : form.synonym.trim() || ""),
        neutral: spectrumBridge.neutral || (form.category === "workplace" ? form.word.trim() : form.one_word_en.trim() || ""),
        informal: spectrumBridge.informal || (form.category === "daily-life" ? form.word.trim() : ""),
      });
      const cleanUserNote = form.notes.trim();
      const finalNotes = cleanUserNote ? `${spectrumMeta}\n${cleanUserNote}` : spectrumMeta;

      const { error } = await supabase.from("words").insert({
        user_id: userRes.user.id,
        word: form.word.trim(),
        type: form.type,
        part_of_speech: form.part_of_speech.trim() || null,
        one_word_en: form.one_word_en.trim() || null,
        one_word_ur: form.one_word_ur.trim() || null,
        synonym: form.synonym.trim() || null,
        antonym: form.antonym.trim() || null,
        definition_en: form.definition_en.trim() || null,
        translation_ur: form.translation_ur.trim() || null,
        example_en: primaryExample.en.trim() || null,
        example_ur: primaryExample.ur.trim() || null,
        examples: validExamples,
        tags: [form.category],
        collocations: parsedCollocations,
        notes: finalNotes || null,
      });
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["words"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Entry saved");
      navigate({ to: "/words" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/words" })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-display font-semibold">Add entry</h1>
      </header>

      <form onSubmit={handleSave} className="space-y-4">
        <Card className="p-4 sm:p-5 space-y-4 shadow-card">
          {/* 1. Word & AI Fill */}
          <div>
            <Label htmlFor="word" className="text-xs font-semibold">
              Word or Phrase <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="word"
                value={form.word}
                onChange={update("word")}
                required
                autoFocus
                placeholder="Type word or phrase..."
                className="h-10 text-base"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleEnrich}
                disabled={enriching}
                className="h-10 px-3.5 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-medium shrink-0"
              >
                <Wand2 className="w-4 h-4 mr-1.5" />
                {enriching ? "Filling…" : "AI fill"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Tap "AI fill" to automatically populate meanings, category, synonyms, and dialogue.
            </p>
          </div>

          {/* 2. Situation Category Selector */}
          <div>
            <Label className="block text-xs font-semibold mb-1.5">Situation Category *</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: "daily-life" }))}
                className={cn(
                  "py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer",
                  form.category === "daily-life"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-600/20"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <span className="text-base">🏠</span>
                <span className="font-semibold text-xs">Daily Life</span>
                <span className="text-[10px] opacity-80 hidden sm:inline">Home & Friends</span>
              </button>

              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: "workplace" }))}
                className={cn(
                  "py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer",
                  form.category === "workplace"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-600/20"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <span className="text-base">💼</span>
                <span className="font-semibold text-xs">Workplace</span>
                <span className="text-[10px] opacity-80 hidden sm:inline">Office & Meetings</span>
              </button>

              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: "news-reading" }))}
                className={cn(
                  "py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer",
                  form.category === "news-reading"
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm ring-2 ring-sky-600/20"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <span className="text-base">📰</span>
                <span className="font-semibold text-xs">News Reading</span>
                <span className="text-[10px] opacity-80 hidden sm:inline">Articles & Essays</span>
              </button>
            </div>
          </div>

          {/* 3. Core Meanings (English & Urdu Aligned) */}
          <div className="pt-2 border-t border-border/60 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="def" className="text-xs font-semibold">
                  English Definition
                </Label>
                <Textarea
                  id="def"
                  rows={2}
                  placeholder="Clear English definition..."
                  value={form.definition_en}
                  onChange={update("definition_en")}
                  className="mt-1.5 text-sm resize-none"
                />
              </div>

              <div>
                <Label htmlFor="ur" className="text-xs font-semibold">
                  Urdu Meaning (عام فہم اردو)
                </Label>
                <Textarea
                  id="ur"
                  rows={2}
                  placeholder="انتہائی آسان اور عام فہم اردو میں معنی..."
                  value={form.translation_ur}
                  onChange={update("translation_ur")}
                  className="mt-1.5 font-urdu text-base sm:text-lg resize-none"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Quick 1-Word Meanings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="one-en" className="text-xs font-semibold">
                  Quick 1-Word (EN)
                </Label>
                <Input
                  id="one-en"
                  placeholder="e.g. tough"
                  value={form.one_word_en}
                  onChange={update("one_word_en")}
                  className="mt-1.5 h-10 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="one-ur" className="text-xs font-semibold">
                  Quick 1-Word (UR)
                </Label>
                <Input
                  id="one-ur"
                  placeholder="مضبوط"
                  value={form.one_word_ur}
                  onChange={update("one_word_ur")}
                  className="mt-1.5 h-10 font-urdu text-base leading-normal"
                  dir="rtl"
                />
              </div>
            </div>
          </div>

          {/* 4. Vocabulary Details & Collocations */}
          <div className="pt-2 border-t border-border/60 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="pos" className="text-xs font-semibold">
                  Part of Speech
                </Label>
                <Input
                  id="pos"
                  placeholder="noun, verb, adj…"
                  value={form.part_of_speech}
                  onChange={update("part_of_speech")}
                  className="mt-1.5 h-10 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="syn" className="text-xs font-semibold">
                  Synonym
                </Label>
                <Input
                  id="syn"
                  placeholder="e.g. strong"
                  value={form.synonym}
                  onChange={update("synonym")}
                  className="mt-1.5 h-10 text-sm"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="ant" className="text-xs font-semibold">
                  Antonym
                </Label>
                <Input
                  id="ant"
                  placeholder="e.g. weak"
                  value={form.antonym}
                  onChange={update("antonym")}
                  className="mt-1.5 h-10 text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="collocations" className="flex items-center gap-1 text-xs font-semibold">
                <BookMarked className="w-3.5 h-3.5 text-muted-foreground" /> Collocations
              </Label>
              <Input
                id="collocations"
                placeholder="put off until, hang out with..."
                value={form.collocationsInput}
                onChange={update("collocationsInput")}
                className="mt-1.5 h-10 text-sm"
              />
            </div>
          </div>

          {/* 5. Context Example Sentences */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Context Example Sentences</Label>
                <p className="text-[11px] text-muted-foreground">
                  Natural English dialogue with simple Urdu translations
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addExample}
                disabled={examples.length >= 4}
                className="h-8 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add sentence
              </Button>
            </div>

            {examples.map((ex, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-border/80 bg-muted/15 space-y-2 relative"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                  <span>Dialogue #{idx + 1}</span>
                  {examples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExample(idx)}
                      className="text-destructive hover:opacity-80 p-1 cursor-pointer"
                      title="Remove sentence"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  placeholder="English example sentence..."
                  value={ex.en}
                  onChange={(e) => updateExample(idx, "en", e.target.value)}
                  className="bg-card h-10 text-sm"
                />
                <Input
                  placeholder="آسان اور عام فہم اردو ترجمہ..."
                  value={ex.ur}
                  onChange={(e) => updateExample(idx, "ur", e.target.value)}
                  className="bg-card h-10 font-urdu text-base leading-normal"
                  dir="rtl"
                />
              </div>
            ))}
          </div>

          {/* 6. Optional Notes */}
          <div className="pt-2 border-t border-border/60">
            <Label htmlFor="notes" className="text-xs font-semibold">
              Personal Notes <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Add your own personal learning notes..."
              value={form.notes}
              onChange={update("notes")}
              className="mt-1.5 text-sm resize-none"
            />
          </div>
        </Card>

        <Button type="submit" disabled={busy} className="w-full h-11 text-sm font-semibold" size="lg">
          <Save className="w-4 h-4 mr-2" /> {busy ? "Saving…" : "Save entry"}
        </Button>
      </form>
    </div>
  );
}

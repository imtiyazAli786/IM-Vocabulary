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
import { toast } from "sonner";

export const Route = createFileRoute("/_app/words/add")({
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
  const enrich = useServerFn(enrichWord);

  const [form, setForm] = useState({
    word: "",
    type: "word" as "word" | "phrase" | "connector" | "idiom" | "tense_pattern",
    part_of_speech: "",
    one_word_en: "",
    one_word_ur: "",
    synonym: "",
    antonym: "",
    definition_en: "",
    translation_ur: "",
    notes: "",
    tagsInput: "",
    collocationsInput: "",
  });

  const [examples, setExamples] = useState<ExamplePair[]>([{ en: "", ur: "" }]);

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

      let inferredType = form.type;
      if (form.type === "word" && form.word.trim().split(/\s+/).length > 1) {
        inferredType = "phrase";
      }

      const generatedTags = r.tags && r.tags.length > 0 ? r.tags.join(", ") : form.tagsInput;

      const generatedCollocations =
        r.collocations && r.collocations.length > 0
          ? r.collocations.join(", ")
          : form.collocationsInput;

      if (r.examples && r.examples.length > 0) {
        setExamples(
          r.examples.map((ex) => ({
            en: ex.en || "",
            ur: ex.ur || "",
          })),
        );
      } else if (r.example_en || r.example_ur) {
        setExamples([{ en: r.example_en || "", ur: r.example_ur || "" }]);
      }

      setForm((f) => ({
        ...f,
        type: inferredType,
        part_of_speech: f.part_of_speech || r.part_of_speech || "",
        one_word_en: f.one_word_en || r.one_word_en || "",
        one_word_ur: f.one_word_ur || r.one_word_ur || "",
        synonym: f.synonym || r.synonym || "",
        antonym: f.antonym || r.antonym || "",
        definition_en: f.definition_en || r.definition_en || "",
        translation_ur: f.translation_ur || r.translation_ur || "",
        tagsInput: f.tagsInput || generatedTags,
        collocationsInput: f.collocationsInput || generatedCollocations,
      }));
      toast.success("Filled with AI suggestions");
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

      const parsedTags = form.tagsInput
        .split(/[,،]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const parsedCollocations = form.collocationsInput
        .split(/[,،\n]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      const validExamples = examples.filter((ex) => ex.en.trim().length > 0);
      const primaryExample = validExamples[0] || { en: "", ur: "" };

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
        tags: parsedTags,
        collocations: parsedCollocations,
        notes: form.notes.trim() || null,
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
        <Card className="p-4 space-y-4 shadow-card">
          <div>
            <Label htmlFor="word">Word or Phrase *</Label>
            <div className="flex gap-2 mt-1.5">
              <Input id="word" value={form.word} onChange={update("word")} required autoFocus />
              <Button type="button" variant="outline" onClick={handleEnrich} disabled={enriching}>
                <Wand2 className="w-4 h-4 mr-1" /> {enriching ? "…" : "AI fill"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Tap "AI fill" to auto-complete definition, Urdu, collocations, tags, and sentences.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select
                value={form.type}
                onValueChange={(val: typeof form.type) => setForm((f) => ({ ...f, type: val }))}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="word">Word</SelectItem>
                  <SelectItem value="phrase">Phrase</SelectItem>
                  <SelectItem value="connector">Connector</SelectItem>
                  <SelectItem value="idiom">Idiom</SelectItem>
                  <SelectItem value="tense_pattern">Tense Pattern</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pos">Part of speech</Label>
              <Input
                id="pos"
                placeholder="noun, verb, adjective…"
                value={form.part_of_speech}
                onChange={update("part_of_speech")}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Tags & Collocations */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tags" className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" /> Tags
              </Label>
              <Input
                id="tags"
                placeholder="daily, academic, business"
                value={form.tagsInput}
                onChange={update("tagsInput")}
                className="mt-1.5 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="collocations" className="flex items-center gap-1">
                <BookMarked className="w-3.5 h-3.5 text-muted-foreground" /> Collocations
              </Label>
              <Input
                id="collocations"
                placeholder="resilient to, highly..."
                value={form.collocationsInput}
                onChange={update("collocationsInput")}
                className="mt-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="one-en">One-word meaning (EN)</Label>
              <Input
                id="one-en"
                placeholder="e.g. tough"
                value={form.one_word_en}
                onChange={update("one_word_en")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="one-ur">One-word meaning (UR)</Label>
              <Input
                id="one-ur"
                placeholder="مضبوط"
                value={form.one_word_ur}
                onChange={update("one_word_ur")}
                className="mt-1.5 font-urdu text-lg"
                dir="rtl"
              />
            </div>
            <div>
              <Label htmlFor="syn">Synonym</Label>
              <Input
                id="syn"
                placeholder="e.g. strong"
                value={form.synonym}
                onChange={update("synonym")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ant">Antonym</Label>
              <Input
                id="ant"
                placeholder="e.g. weak"
                value={form.antonym}
                onChange={update("antonym")}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="def">English definition</Label>
            <Textarea
              id="def"
              rows={2}
              value={form.definition_en}
              onChange={update("definition_en")}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="ur">Urdu translation</Label>
            <Textarea
              id="ur"
              rows={2}
              value={form.translation_ur}
              onChange={update("translation_ur")}
              className="mt-1.5 font-urdu text-xl"
              dir="rtl"
            />
          </div>

          {/* Multiple Context Sentences */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Context Example Sentences</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addExample}
                disabled={examples.length >= 4}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add sentence
              </Button>
            </div>

            {examples.map((ex, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2 relative"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Sentence {idx + 1}</span>
                  {examples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExample(idx)}
                      className="text-destructive hover:opacity-80 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Textarea
                  placeholder="English example sentence..."
                  rows={2}
                  value={ex.en}
                  onChange={(e) => updateExample(idx, "en", e.target.value)}
                  className="bg-card"
                />
                <Textarea
                  placeholder="اردو ترجمہ..."
                  rows={2}
                  value={ex.ur}
                  onChange={(e) => updateExample(idx, "ur", e.target.value)}
                  className="bg-card font-urdu text-lg"
                  dir="rtl"
                />
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={update("notes")}
              className="mt-1.5"
            />
          </div>
        </Card>

        <Button type="submit" disabled={busy} className="w-full" size="lg">
          <Save className="w-4 h-4 mr-2" /> {busy ? "Saving…" : "Save entry"}
        </Button>
      </form>
    </div>
  );
}

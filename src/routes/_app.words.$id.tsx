import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { simplifySentencesBatch, enrichWord, regenerateUrduOnly } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Loader2,
  Tag,
  BookMarked,
  Sparkles,
  Check,
  Save,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";
import { speak } from "@/lib/speech";
import { TYPE_COLORS, formatType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  FormalityRegister,
  REGISTER_CONFIG,
  CATEGORY_CONFIG,
  PermanentCategory,
  extractFormalitySpectrum,
  cleanUserNotes,
} from "@/lib/formality";
import { FormalitySpectrum } from "@/components/FormalitySpectrum";

export const Route = createFileRoute("/_app/words/$id")({
  component: WordDetailPage,
});

interface ExampleItem {
  en: string;
  ur?: string;
}

function WordDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const simplifyBatch = useServerFn(simplifySentencesBatch);

  const { data: w, isLoading } = useQuery({
    queryKey: ["word", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("words").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    initialData: () => {
      const list = qc.getQueryData<any[]>(["words-all-raw"]);
      return list?.find((item) => item.id === id);
    },
    staleTime: 5 * 60_000,
  });

  const { data: words } = useQuery({
    queryKey: ["words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("words")
        .select("id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    initialData: () => {
      const list = qc.getQueryData<any[]>(["words-all-raw"]);
      return list?.map((x) => ({ id: x.id }));
    },
    staleTime: 5 * 60_000,
  });

  const idx = words?.findIndex((x) => x.id === id) ?? -1;
  const prevId = idx > 0 ? words![idx - 1].id : null;
  const nextId = idx >= 0 && words && idx < words.length - 1 ? words[idx + 1].id : null;

  const [deleting, setDeleting] = useState(false);
  const [simplifyingSentenceIdx, setSimplifyingSentenceIdx] = useState<number | null>(null);

  const enrich = useServerFn(enrichWord);
  const regenUrdu = useServerFn(regenerateUrduOnly);

  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState<"full" | "urdu" | null>(null);
  const [autoFillingEdit, setAutoFillingEdit] = useState(false);

  const handleFullRegenerate = async () => {
    if (!w) return;
    setRegenerating("full");
    try {
      toast.info(`Regenerating full details for "${w.word}" with AI…`);
      const r = await enrich({ data: { word: w.word } });
      if (!r || (!r.one_word_ur && !r.translation_ur && !r.definition_en)) {
        throw new Error("AI service did not return data for this word. Please try again.");
      }

      const parsedCollocations = r.collocations || (Array.isArray(w.collocations) ? w.collocations : []);
      const detectedCat = r.category || (r.register === "formal" ? "news-reading" : r.register === "neutral" ? "workplace" : "daily-life");

      const spectrumMeta = JSON.stringify({
        category: detectedCat,
        formal: r.formal || r.formal_equivalent || "",
        neutral: r.neutral || r.neutral_equivalent || "",
        informal: r.informal || r.spoken_equivalent || "",
      });
      const cleanNote = cleanUserNotes(w.notes);
      const finalNotes = cleanNote ? `${spectrumMeta}\n${cleanNote}` : spectrumMeta;

      const updatedExamples = r.examples && r.examples.length > 0
        ? r.examples
        : (r.example_en || r.example_ur)
        ? [{ en: r.example_en || "", ur: r.example_ur || "" }]
        : (Array.isArray(w.examples) ? w.examples : []);

      const updatePayload = {
        part_of_speech: r.part_of_speech || w.part_of_speech,
        one_word_en: r.one_word_en || w.one_word_en,
        one_word_ur: r.one_word_ur || w.one_word_ur,
        definition_en: r.definition_en || w.definition_en,
        translation_ur: r.translation_ur || w.translation_ur,
        synonym: r.synonym || w.synonym,
        antonym: r.antonym || w.antonym,
        example_en: r.example_en || w.example_en,
        example_ur: r.example_ur || w.example_ur,
        examples: updatedExamples,
        collocations: parsedCollocations,
        tags: [detectedCat],
        notes: finalNotes,
      };

      const { error } = await supabase
        .from("words")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      qc.setQueryData(["word", id], (old: any) => (old ? { ...old, ...updatePayload } : old));
      qc.setQueryData<any[]>(["words-all-raw"], (old) =>
        old ? old.map((item) => (item.id === id ? { ...item, ...updatePayload } : item)) : []
      );

      await qc.invalidateQueries({ queryKey: ["word", id] });
      await qc.invalidateQueries({ queryKey: ["words"] });
      await qc.invalidateQueries({ queryKey: ["words-all-raw"] });
      await qc.invalidateQueries({ queryKey: ["words-sentences"] });
      toast.success(`Successfully regenerated "${w.word}"!`);
      setRegenOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate word");
    } finally {
      setRegenerating(null);
    }
  };

  const handleUrduOnlyRegenerate = async () => {
    if (!w) return;
    setRegenerating("urdu");
    try {
      toast.info(`Generating simple Urdu translations for "${w.word}"…`);
      const existingSentenceTexts = (Array.isArray(w.examples) && w.examples.length > 0
        ? (w.examples as ExampleItem[]).map((s) => s.en).filter(Boolean)
        : w.example_en ? [w.example_en] : []
      );

      const r = await regenUrdu({
        data: {
          word: w.word,
          definition_en: w.definition_en || undefined,
          examples_en: existingSentenceTexts.length > 0 ? existingSentenceTexts : undefined,
        },
      });

      if (!r || (!r.one_word_ur && !r.translation_ur)) {
        throw new Error("AI could not generate Urdu translations. Please try again.");
      }

      let updatedExamples = Array.isArray(w.examples) ? [...w.examples] : [];
      if (r.examples && r.examples.length > 0) {
        updatedExamples = r.examples;
      }

      const updatePayload = {
        one_word_ur: r.one_word_ur || w.one_word_ur,
        translation_ur: r.translation_ur || w.translation_ur,
        example_ur: updatedExamples[0]?.ur || w.example_ur,
        examples: updatedExamples,
      };

      const { error } = await supabase
        .from("words")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      qc.setQueryData(["word", id], (old: any) => (old ? { ...old, ...updatePayload } : old));
      qc.setQueryData<any[]>(["words-all-raw"], (old) =>
        old ? old.map((item) => (item.id === id ? { ...item, ...updatePayload } : item)) : []
      );

      await qc.invalidateQueries({ queryKey: ["word", id] });
      await qc.invalidateQueries({ queryKey: ["words"] });
      await qc.invalidateQueries({ queryKey: ["words-all-raw"] });
      await qc.invalidateQueries({ queryKey: ["words-sentences"] });
      toast.success(`Updated Urdu for "${w.word}"!`);
      setRegenOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate Urdu");
    } finally {
      setRegenerating(null);
    }
  };

  const handleAutoFillEdit = async () => {
    if (!editForm.word.trim()) {
      toast.error("Enter a word first");
      return;
    }
    setAutoFillingEdit(true);
    try {
      toast.info(`Fetching AI data for "${editForm.word}"…`);
      const r = await enrich({ data: { word: editForm.word.trim() } });
      const detectedCat = r.category || (r.register === "formal" ? "news-reading" : r.register === "neutral" ? "workplace" : "daily-life");
      const generatedCollocations = r.collocations && r.collocations.length > 0 ? r.collocations.join(", ") : editForm.collocationsInput;

      setEditForm((f) => ({
        ...f,
        part_of_speech: r.part_of_speech || f.part_of_speech,
        category: (detectedCat as PermanentCategory) || f.category,
        informal: r.informal || r.spoken_equivalent || f.informal,
        neutral: r.neutral || r.neutral_equivalent || f.neutral,
        formal: r.formal || r.formal_equivalent || f.formal,
        definition_en: r.definition_en || f.definition_en,
        translation_ur: r.translation_ur || f.translation_ur,
        one_word_en: r.one_word_en || f.one_word_en,
        one_word_ur: r.one_word_ur || f.one_word_ur,
        synonym: r.synonym || f.synonym,
        antonym: r.antonym || f.antonym,
        collocationsInput: generatedCollocations,
      }));
      toast.success("Form populated with AI data! Review and click Save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI Auto-Fill failed");
    } finally {
      setAutoFillingEdit(false);
    }
  };

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    word: "",
    part_of_speech: "",
    category: "daily-life" as PermanentCategory,
    one_word_en: "",
    one_word_ur: "",
    definition_en: "",
    translation_ur: "",
    synonym: "",
    antonym: "",
    formal: "",
    neutral: "",
    informal: "",
    collocationsInput: "",
    notes: "",
  });

  const openEditModal = () => {
    if (!w) return;
    const spectrum = extractFormalitySpectrum(w);
    const collocations = Array.isArray(w.collocations) ? (w.collocations as string[]).join(", ") : "";
    setEditForm({
      word: w.word || "",
      part_of_speech: w.part_of_speech || "",
      category: spectrum.category || "daily-life",
      one_word_en: w.one_word_en || "",
      one_word_ur: w.one_word_ur || "",
      definition_en: w.definition_en || "",
      translation_ur: w.translation_ur || "",
      synonym: w.synonym || "",
      antonym: w.antonym || "",
      formal: spectrum.formal || "",
      neutral: spectrum.neutral || "",
      informal: spectrum.informal || "",
      collocationsInput: collocations,
      notes: cleanUserNotes(w.notes),
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.word.trim()) {
      toast.error("Word is required");
      return;
    }
    setSavingEdit(true);
    try {
      const parsedCollocations = editForm.collocationsInput
        .split(/[,،\n]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      const spectrumMeta = JSON.stringify({
        category: editForm.category,
        formal: editForm.formal.trim(),
        neutral: editForm.neutral.trim(),
        informal: editForm.informal.trim(),
      });
      const cleanNote = editForm.notes.trim();
      const finalNotes = cleanNote ? `${spectrumMeta}\n${cleanNote}` : spectrumMeta;

      const { error } = await supabase
        .from("words")
        .update({
          word: editForm.word.trim(),
          part_of_speech: editForm.part_of_speech.trim() || null,
          one_word_en: editForm.one_word_en.trim() || null,
          one_word_ur: editForm.one_word_ur.trim() || null,
          definition_en: editForm.definition_en.trim() || null,
          translation_ur: editForm.translation_ur.trim() || null,
          synonym: editForm.synonym.trim() || null,
          antonym: editForm.antonym.trim() || null,
          collocations: parsedCollocations,
          tags: [editForm.category],
          notes: finalNotes,
        })
        .eq("id", id);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["word", id] });
      qc.invalidateQueries({ queryKey: ["words"] });
      qc.invalidateQueries({ queryKey: ["words-sentences"] });
      toast.success("Word updated successfully");
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update word");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("words").delete().eq("id", id);
      if (error) throw error;
      toast.success("Word deleted");
      qc.invalidateQueries({ queryKey: ["words"] });
      qc.invalidateQueries({ queryKey: ["words-sentences"] });
      navigate({ to: "/words" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete word");
    } finally {
      setDeleting(false);
    }
  };

  const handleSimplifySentence = async (sIdx: number, enText: string) => {
    if (!w || simplifyingSentenceIdx !== null) return;
    setSimplifyingSentenceIdx(sIdx);
    try {
      const res = await simplifyBatch({
        data: {
          sentences: [{ id: `${w.id}-${sIdx}`, word: w.word, en: enText }],
        },
      });
      const newUr = res.translations?.[0]?.ur;
      if (newUr) {
        let updatedExamples = Array.isArray(w.examples) ? [...w.examples] : [];
        if (updatedExamples[sIdx]) {
          updatedExamples[sIdx] = { ...updatedExamples[sIdx], ur: newUr };
        } else {
          updatedExamples = [{ en: enText, ur: newUr }];
        }

        await supabase
          .from("words")
          .update({ examples: updatedExamples, example_ur: sIdx === 0 ? newUr : w.example_ur })
          .eq("id", w.id);

        qc.invalidateQueries({ queryKey: ["word", id] });
        qc.invalidateQueries({ queryKey: ["words-sentences"] });
        toast.success("Sentence simplified to easy Urdu!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simplification error");
    } finally {
      setSimplifyingSentenceIdx(null);
    }
  };

  if (isLoading && !w) {
    return (
      <div className="space-y-4 max-w-xl mx-auto pb-6">
        <header className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/words" })} className="h-8 px-2 text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Words
          </Button>
        </header>
        <div className="p-6 rounded-2xl border border-border/70 bg-card/60 animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-36" />
          <div className="h-5 bg-muted/60 rounded w-20" />
          <div className="h-20 bg-muted/30 rounded-xl w-full" />
        </div>
      </div>
    );
  }
  if (!w) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/words" })}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Card className="p-8 text-center">
          <p className="font-medium">Word not found</p>
        </Card>
      </div>
    );
  }

  const tags = Array.isArray(w.tags) ? (w.tags as string[]) : [];
  const collocations = Array.isArray(w.collocations) ? (w.collocations as string[]) : [];
  const spectrum = extractFormalitySpectrum(w);

  const sentences: ExampleItem[] =
    Array.isArray(w.examples) && w.examples.length > 0
      ? (w.examples as ExampleItem[]).filter((x) => x && x.en)
      : w.example_en
      ? [{ en: w.example_en, ur: w.example_ur || undefined }]
      : [];

  return (
    <div className="space-y-3 max-w-xl mx-auto pb-6">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/words" })}
          className="h-8 px-2 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Words
        </Button>

        {/* Prev / Next navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => prevId && navigate({ to: "/words/$id", params: { id: prevId } })}
            disabled={!prevId}
            className="h-8 px-2.5 text-xs"
            title="Previous word"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => nextId && navigate({ to: "/words/$id", params: { id: nextId } })}
            disabled={!nextId}
            className="h-8 px-2.5 text-xs"
            title="Next word"
          >
            Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRegenOpen(true)}
            className="h-8 px-2.5 text-xs font-medium border-primary/40 text-primary hover:bg-primary/10"
            title="Regenerate with AI"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Regenerate
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={openEditModal}
            className="h-8 px-2.5 text-xs font-medium"
          >
            <Pencil className="w-3.5 h-3.5 mr-1 text-primary" /> Edit
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{w.word}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this word and its practice history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <Card className="p-5 sm:p-7 rounded-2xl shadow-elevated border-border bg-card flex flex-col space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/70">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
                    {w.word}
                  </h1>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9 rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(w.word);
                    }}
                    title="Listen to pronunciation"
                  >
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {w.part_of_speech && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {w.part_of_speech}
                    </span>
                  )}
                  {/* Register Badge */}
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2.5 py-0.5 rounded-full border",
                      REGISTER_CONFIG[spectrum.register]?.colorBadge || "bg-muted text-muted-foreground"
                    )}
                  >
                    {REGISTER_CONFIG[spectrum.register]?.label}
                  </span>
                  {w.type && w.type !== "word" && (
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${TYPE_COLORS[w.type] || "bg-muted text-muted-foreground"}`}
                    >
                      {formatType(w.type)}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                {w.one_word_ur ? (
                  <div className="flex items-center gap-1.5 justify-end">
                    <p className="font-urdu text-xl sm:text-2xl font-semibold text-primary leading-normal" dir="rtl">
                      {w.one_word_ur}
                    </p>
                    <button
                      type="button"
                      onClick={handleUrduOnlyRegenerate}
                      disabled={!!regenerating}
                      className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-full hover:bg-primary/10 cursor-pointer"
                      title="Regenerate Urdu meaning with AI"
                      aria-label="Regenerate Urdu meaning with AI"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", regenerating === "urdu" && "animate-spin text-primary")} />
                    </button>
                  </div>
                ) : w.translation_ur ? (
                  <div className="flex items-center gap-1.5 justify-end">
                    <p className="font-urdu text-lg sm:text-xl font-medium text-primary leading-normal" dir="rtl">
                      {w.translation_ur}
                    </p>
                    <button
                      type="button"
                      onClick={handleUrduOnlyRegenerate}
                      disabled={!!regenerating}
                      className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-full hover:bg-primary/10 cursor-pointer"
                      title="Regenerate Urdu meaning with AI"
                      aria-label="Regenerate Urdu meaning with AI"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", regenerating === "urdu" && "animate-spin text-primary")} />
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUrduOnlyRegenerate}
                    disabled={!!regenerating}
                    className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
                  >
                    {regenerating === "urdu" ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    Generate Urdu
                  </Button>
                )}
              </div>
            </div>

            {/* Formality Spectrum Module */}
            <FormalitySpectrum data={spectrum} headword={w.word} />

            {(w.one_word_en || w.synonym || w.antonym) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {w.one_word_en && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      Quick Meaning
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {w.one_word_en}
                    </p>
                  </div>
                )}
                {w.synonym && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
                      Synonym
                    </p>
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      {w.synonym}
                    </p>
                  </div>
                )}
                {w.antonym && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-rose-700 dark:text-rose-300">
                      Antonym
                    </p>
                    <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                      {w.antonym}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 pt-1">
              {w.definition_en && (
                <div className="p-4 rounded-xl bg-card border border-border space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    English Definition
                  </p>
                  <p className="text-base text-foreground leading-relaxed">
                    {w.definition_en}
                  </p>
                </div>
              )}

              {(w.translation_ur || w.one_word_ur) ? (
                <div className="p-4 rounded-xl bg-card border border-border space-y-1 text-right" dir="rtl">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-left" dir="ltr">
                    Urdu Meaning
                  </p>
                  <p className="font-urdu text-xl sm:text-2xl text-foreground/90 font-medium leading-relaxed pt-1">
                    {w.translation_ur || w.one_word_ur}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border/80 text-center">
                  <p className="text-xs text-muted-foreground">
                    No Urdu meaning added yet. Click{" "}
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="font-semibold text-primary underline cursor-pointer"
                    >
                      Edit
                    </button>{" "}
                    to add one.
                  </p>
                </div>
              )}
            </div>

            {collocations.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                  Collocations:
                </span>
                {collocations.map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border"
                  >
                    <BookMarked className="w-3 h-3 opacity-70" /> {col}
                  </span>
                ))}
              </div>
            )}

            {sentences.length > 0 && (
              <div className="pt-3 border-t border-border/60 space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  Context Usage Examples ({sentences.length})
                </p>
                <div className="space-y-3">
                  {sentences.map((sentence, sIdx) => {
                    const isSimplifying = simplifyingSentenceIdx === sIdx;
                    return (
                      <div
                        key={sIdx}
                        className="p-4 rounded-xl bg-muted/20 border border-border/70 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 rounded-full bg-card hover:bg-primary/10 shrink-0 mt-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                speak(sentence.en || "");
                              }}
                              title="Listen to sentence"
                            >
                              <Volume2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <p className="text-base font-serif text-foreground leading-relaxed">
                              "{sentence.en}"
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/40 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Translation
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSimplifySentence(sIdx, sentence.en)}
                              disabled={isSimplifying}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium cursor-pointer"
                              title="Simplify to easy conversational Urdu"
                            >
                              <Sparkles className={cn("w-3 h-3", isSimplifying && "animate-spin")} />
                              <span>{isSimplifying ? "Simplifying…" : "Easy Urdu"}</span>
                            </button>
                          </div>

                          {sentence.ur && (
                            <p
                              className="font-urdu text-lg sm:text-xl text-foreground/90 text-right leading-relaxed pt-1"
                              dir="rtl"
                            >
                              {sentence.ur}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cleanUserNotes(w.notes) && (
              <div className="pt-3 border-t border-border/60 space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Notes
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{cleanUserNotes(w.notes)}</p>
              </div>
            )}
          </Card>

      {/* Edit Word Dialog Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between gap-2 pr-6">
            <div>
              <DialogTitle>Edit Word: {w.word}</DialogTitle>
              <DialogDescription>
                Update word details, meanings, category, and formality equivalents.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFillEdit}
              disabled={autoFillingEdit}
              className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
            >
              {autoFillingEdit ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5 mr-1" />
              )}
              Auto-Fill with AI
            </Button>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            {/* Word & Part of Speech */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-word" className="text-xs font-semibold">
                  Word / Phrase <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-word"
                  value={editForm.word}
                  onChange={(e) => setEditForm((f) => ({ ...f, word: e.target.value }))}
                  required
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="edit-pos" className="text-xs font-semibold">
                  Part of Speech
                </Label>
                <Input
                  id="edit-pos"
                  placeholder="noun, verb, adj…"
                  value={editForm.part_of_speech}
                  onChange={(e) => setEditForm((f) => ({ ...f, part_of_speech: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <Label className="block text-xs font-semibold mb-1">Situation Category</Label>
              <div role="radiogroup" aria-label="Situation Category" className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={editForm.category === "daily-life"}
                  onClick={() => setEditForm((f) => ({ ...f, category: "daily-life" }))}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-xs font-medium transition-all text-center flex flex-col items-center cursor-pointer",
                    editForm.category === "daily-life"
                      ? "bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 border-purple-300 shadow-xs ring-1 ring-purple-400/20 font-semibold"
                      : "bg-card text-muted-foreground border-border hover:border-purple-200 hover:text-foreground"
                  )}
                >
                  <span>🏠 Daily Life</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={editForm.category === "workplace"}
                  onClick={() => setEditForm((f) => ({ ...f, category: "workplace" }))}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-xs font-medium transition-all text-center flex flex-col items-center cursor-pointer",
                    editForm.category === "workplace"
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300 shadow-xs ring-1 ring-emerald-400/20 font-semibold"
                      : "bg-card text-muted-foreground border-border hover:border-emerald-200 hover:text-foreground"
                  )}
                >
                  <span>💼 Workplace</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={editForm.category === "news-reading"}
                  onClick={() => setEditForm((f) => ({ ...f, category: "news-reading" }))}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-xs font-medium transition-all text-center flex flex-col items-center cursor-pointer",
                    editForm.category === "news-reading"
                      ? "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200 border-sky-300 shadow-xs ring-1 ring-sky-400/20 font-semibold"
                      : "bg-card text-muted-foreground border-border hover:border-sky-200 hover:text-foreground"
                  )}
                >
                  <span>📰 News Reading</span>
                </button>
              </div>
            </div>

            {/* Formality Spectrum Equivalents */}
            <div className="p-3 rounded-xl bg-muted/20 border border-border/80 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Formality Spectrum Equivalents
              </p>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="edit-informal" className="text-xs text-muted-foreground">
                    🏠 Daily Life (Informal / Spoken)
                  </Label>
                  <Input
                    id="edit-informal"
                    placeholder="Informal conversational equivalent..."
                    value={editForm.informal}
                    onChange={(e) => setEditForm((f) => ({ ...f, informal: e.target.value }))}
                    className="mt-1 h-8 text-base sm:text-xs bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-neutral" className="text-xs text-muted-foreground">
                    💼 Workplace (Neutral / Professional)
                  </Label>
                  <Input
                    id="edit-neutral"
                    placeholder="Workplace professional equivalent..."
                    value={editForm.neutral}
                    onChange={(e) => setEditForm((f) => ({ ...f, neutral: e.target.value }))}
                    className="mt-1 h-8 text-base sm:text-xs bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-formal" className="text-xs text-muted-foreground">
                    📰 News Reading (Formal / Academic)
                  </Label>
                  <Input
                    id="edit-formal"
                    placeholder="Formal / editorial equivalent..."
                    value={editForm.formal}
                    onChange={(e) => setEditForm((f) => ({ ...f, formal: e.target.value }))}
                    className="mt-1 h-8 text-base sm:text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            {/* English Definition & Urdu Meaning */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-def" className="text-xs font-semibold">
                  English Definition
                </Label>
                <Textarea
                  id="edit-def"
                  rows={2}
                  value={editForm.definition_en}
                  onChange={(e) => setEditForm((f) => ({ ...f, definition_en: e.target.value }))}
                  className="mt-1 text-xs resize-none"
                />
              </div>
              <div>
                <Label htmlFor="edit-ur" className="text-xs font-semibold">
                  Urdu Meaning
                </Label>
                <Textarea
                  id="edit-ur"
                  rows={2}
                  value={editForm.translation_ur}
                  onChange={(e) => setEditForm((f) => ({ ...f, translation_ur: e.target.value }))}
                  className="mt-1 font-urdu text-sm resize-none"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Quick 1-Word EN & UR */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-one-en" className="text-xs font-semibold">
                  Quick 1-Word (EN)
                </Label>
                <Input
                  id="edit-one-en"
                  value={editForm.one_word_en}
                  onChange={(e) => setEditForm((f) => ({ ...f, one_word_en: e.target.value }))}
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="edit-one-ur" className="text-xs font-semibold">
                  Quick 1-Word (UR)
                </Label>
                <Input
                  id="edit-one-ur"
                  value={editForm.one_word_ur}
                  onChange={(e) => setEditForm((f) => ({ ...f, one_word_ur: e.target.value }))}
                  className="mt-1 h-9 font-urdu text-sm"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Synonym & Antonym */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-syn" className="text-xs font-semibold">
                  Synonym
                </Label>
                <Input
                  id="edit-syn"
                  value={editForm.synonym}
                  onChange={(e) => setEditForm((f) => ({ ...f, synonym: e.target.value }))}
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="edit-ant" className="text-xs font-semibold">
                  Antonym
                </Label>
                <Input
                  id="edit-ant"
                  value={editForm.antonym}
                  onChange={(e) => setEditForm((f) => ({ ...f, antonym: e.target.value }))}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            {/* Collocations */}
            <div>
              <Label htmlFor="edit-collocations" className="text-xs font-semibold">
                Collocations (comma-separated)
              </Label>
              <Input
                id="edit-collocations"
                placeholder="deal with, take care of..."
                value={editForm.collocationsInput}
                onChange={(e) => setEditForm((f) => ({ ...f, collocationsInput: e.target.value }))}
                className="mt-1 h-9 text-xs"
              />
            </div>

            {/* Personal Notes */}
            <div>
              <Label htmlFor="edit-notes" className="text-xs font-semibold">
                Personal Notes
              </Label>
              <Textarea
                id="edit-notes"
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEdit}>
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {savingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Regenerate Options Modal */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Regenerate "{w.word}" with AI
            </DialogTitle>
            <DialogDescription>
              Choose how you want AI to enhance or translate this word.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <Card
              className="p-4 hover:border-primary/50 cursor-pointer transition-colors shadow-xs group"
              onClick={() => !regenerating && handleFullRegenerate()}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-foreground">Full AI Re-Enrichment</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Regenerates definition, 1-word Urdu, Urdu translation, situation category, formality spectrum, collocations, and easy Urdu example sentences.
                  </p>
                </div>
                {regenerating === "full" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              </div>
            </Card>

            <Card
              className="p-4 hover:border-primary/50 cursor-pointer transition-colors shadow-xs group"
              onClick={() => !regenerating && handleUrduOnlyRegenerate()}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-foreground">Regenerate Urdu Only</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Refreshes 1-word Urdu, Urdu definition, and sentence translations in very simple conversational Urdu. Preserves your custom English definitions and personal notes.
                  </p>
                </div>
                {regenerating === "urdu" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRegenOpen(false)} disabled={!!regenerating}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

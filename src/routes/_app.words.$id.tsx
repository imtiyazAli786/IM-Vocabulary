import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { simplifySentencesBatch } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  ChevronUp,
  ChevronDown,
  Volume2,
  Loader2,
  Tag,
  BookMarked,
  Sparkles,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";
import { speak } from "@/lib/speech";
import { TYPE_COLORS, formatType } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/words/$id")({
  component: WordDetailPage,
});

const SWIPE_THRESHOLD = 80;

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
    staleTime: 60_000,
  });

  const idx = words?.findIndex((x) => x.id === id) ?? -1;
  const prevId = idx > 0 ? words![idx - 1].id : null;
  const nextId = idx >= 0 && words && idx < words.length - 1 ? words[idx + 1].id : null;

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "up" | "down">(null);
  const startY = useRef(0);
  const moved = useRef(false);

  const [deleting, setDeleting] = useState(false);
  const [simplifyingSentenceIdx, setSimplifyingSentenceIdx] = useState<number | null>(null);

  const goTo = (targetId: string, dir: "up" | "down") => {
    setExiting(dir);
    const timer = window.setTimeout(() => {
      setDragY(0);
      setExiting(null);
      navigate({ to: "/words/$id", params: { id: targetId } });
    }, 200);
    return () => clearTimeout(timer);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (exiting) return;
    startY.current = e.clientY;
    moved.current = false;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || exiting) return;
    const dy = e.clientY - startY.current;
    if (Math.abs(dy) > 5) moved.current = true;
    setDragY(dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging || exiting) return;
    setDragging(false);
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {}

    if (dragY < -SWIPE_THRESHOLD && nextId) {
      goTo(nextId, "up");
    } else if (dragY > SWIPE_THRESHOLD && prevId) {
      goTo(prevId, "down");
    } else {
      setDragY(0);
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

  if (isLoading) return <LoadingScreen />;
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

  const translateY = exiting === "up" ? -300 : exiting === "down" ? 300 : dragY;
  const rotate = dragY * 0.03;
  const opacity = exiting ? 0 : 1 - Math.min(Math.abs(dragY) / 300, 0.4);

  const showUpHint = dragY < -20 && nextId;
  const showDownHint = dragY > 20 && prevId;

  const tags = Array.isArray(w.tags) ? (w.tags as string[]) : [];
  const collocations = Array.isArray(w.collocations) ? (w.collocations as string[]) : [];

  const sentences: ExampleItem[] =
    Array.isArray(w.examples) && w.examples.length > 0
      ? (w.examples as ExampleItem[]).filter((x) => x && x.en)
      : w.example_en
      ? [{ en: w.example_en, ur: w.example_ur || undefined }]
      : [];

  return (
    <div className="space-y-3 max-w-xl mx-auto pb-6">
      <header className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/words" })}
          className="h-8 px-2 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to words
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
      </header>

      <div className="relative touch-none select-none flex-1 flex">
        <div
          className={`pointer-events-none absolute inset-x-0 -top-2 flex justify-center transition-opacity z-10 ${showUpHint ? "opacity-100" : "opacity-0"}`}
        >
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-card">
            <ChevronUp className="w-3.5 h-3.5" /> Next word
          </div>
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center transition-opacity z-10 ${showDownHint ? "opacity-100" : "opacity-0"}`}
        >
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-card">
            <ChevronDown className="w-3.5 h-3.5" /> Previous word
          </div>
        </div>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
            opacity,
            transition: dragging ? "none" : "transform 200ms ease, opacity 200ms ease",
          }}
          className="flex flex-col gap-4 flex-1 w-full"
        >
          <Card className="p-5 sm:p-7 rounded-2xl shadow-elevated border-border bg-card flex-1 flex flex-col space-y-5">
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
                  {w.type && w.type !== "word" && (
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${TYPE_COLORS[w.type] || "bg-muted text-muted-foreground"}`}
                    >
                      {formatType(w.type)}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                {w.one_word_ur ? (
                  <p className="font-urdu text-3xl sm:text-4xl font-bold text-primary leading-tight" dir="rtl">
                    {w.one_word_ur}
                  </p>
                ) : w.translation_ur ? (
                  <p className="font-urdu text-2xl font-bold text-primary leading-tight" dir="rtl">
                    {w.translation_ur}
                  </p>
                ) : null}
              </div>
            </div>

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

              {w.translation_ur && (
                <div className="p-4 rounded-xl bg-card border border-border space-y-1 text-right" dir="rtl">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-left" dir="ltr">
                    Urdu Meaning
                  </p>
                  <p className="font-urdu text-2xl sm:text-3xl text-foreground leading-loose pt-1">
                    {w.translation_ur}
                  </p>
                </div>
              )}
            </div>

            {(tags.length > 0 || collocations.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    <Tag className="w-3 h-3" /> #{tag}
                  </span>
                ))}
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
                              className="font-urdu text-xl sm:text-2xl text-foreground/90 text-right leading-loose pt-1"
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

            {w.notes && (
              <div className="pt-3 border-t border-border/60 space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Notes
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{w.notes}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

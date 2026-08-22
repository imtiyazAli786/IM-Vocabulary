import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";
import { speak } from "@/lib/speech";
import { TYPE_COLORS, formatType } from "@/lib/constants";

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

  // Drag state
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "up" | "down">(null);
  const startY = useRef(0);
  const moved = useRef(false);

  const [deleting, setDeleting] = useState(false);

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
    if (!dragging) return;
    const dy = e.clientY - startY.current;
    if (Math.abs(dy) > 4) moved.current = true;
    setDragY(dy);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const dy = dragY;
    if (!moved.current) {
      setDragY(0);
      return;
    }
    if (dy <= -SWIPE_THRESHOLD && nextId) {
      goTo(nextId, "up");
    } else if (dy >= SWIPE_THRESHOLD && prevId) {
      goTo(prevId, "down");
    } else {
      setDragY(0);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const { error } = await supabase.from("words").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Failed to delete. Please try again.");
      setDeleting(false);
      return;
    }
    qc.invalidateQueries({ queryKey: ["words"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["review-queue"] });
    toast.success("Deleted");
    navigate({ to: "/words" });
  };

  if (isLoading) return <LoadingScreen />;
  if (!w) return <p className="text-muted-foreground">Not found.</p>;

  const translateY = exiting === "up" ? -800 : exiting === "down" ? 800 : dragY;
  const rotate = (translateY / 40).toFixed(2);
  const opacity = exiting ? 0 : Math.max(0.4, 1 - Math.abs(dragY) / 400);
  const showUpHint = dragY < -20 && !!nextId;
  const showDownHint = dragY > 20 && !!prevId;

  // Resolve multiple examples
  let sentences: ExampleItem[] = [];
  if (Array.isArray(w.examples) && w.examples.length > 0) {
    sentences = w.examples as ExampleItem[];
  } else if (w.example_en || w.example_ur) {
    sentences = [{ en: w.example_en || "", ur: w.example_ur || "" }];
  }

  const tags = Array.isArray(w.tags) ? w.tags : [];
  const collocations = Array.isArray(w.collocations) ? w.collocations : [];

  return (
    <div className="flex flex-col gap-4 overflow-hidden min-h-[calc(100dvh-8rem)]">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/words" })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        {idx >= 0 && words && (
          <p className="text-xs text-muted-foreground">
            {idx + 1} / {words.length}
          </p>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={deleting}>
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin text-destructive" />
              ) : (
                <Trash2 className="w-4 h-4 text-destructive" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{w.word}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this entry and all its review history. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <div className="relative touch-none select-none -mx-4 sm:mx-0 flex-1 flex">
        <div
          className={`pointer-events-none absolute inset-x-0 -top-1 flex justify-center transition-opacity z-10 ${showUpHint ? "opacity-100" : "opacity-0"}`}
        >
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-card">
            <ChevronUp className="w-3.5 h-3.5" /> Next word
          </div>
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 -bottom-1 flex justify-center transition-opacity z-10 ${showDownHint ? "opacity-100" : "opacity-0"}`}
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
          <Card className="order-2 sm:order-none p-5 sm:p-6 rounded-none sm:rounded-xl border-x-0 sm:border-x shadow-card flex-1 flex flex-col">
            {/* One-line header */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 justify-center pb-4 border-b border-border">
              <h1 className="text-3xl font-display font-semibold leading-tight">{w.word}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  speak(w.word);
                }}
              >
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              </Button>
              {w.type && w.type !== "word" && (
                <span
                  className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded font-medium ${TYPE_COLORS[w.type] || "bg-muted text-muted-foreground"}`}
                >
                  {formatType(w.type)}
                </span>
              )}
              {w.part_of_speech && (
                <span className="text-sm italic text-muted-foreground">({w.part_of_speech})</span>
              )}
              {w.one_word_en && <span className="text-primary font-semibold">{w.one_word_en}</span>}
              {w.one_word_ur && (
                <span className="font-urdu text-2xl text-primary font-semibold" dir="rtl">
                  {w.one_word_ur}
                </span>
              )}
              {w.synonym && (
                <span className="ml-1 px-2 py-0.5 rounded bg-success/10 text-success text-sm">
                  <span className="text-xs uppercase tracking-wider opacity-70 mr-1">Syn</span>
                  {w.synonym}
                </span>
              )}
              {w.antonym && (
                <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive text-sm">
                  <span className="text-xs uppercase tracking-wider opacity-70 mr-1">Ant</span>
                  {w.antonym}
                </span>
              )}
            </div>

            {/* Tags & Collocations Bar */}
            {(tags.length > 0 || collocations.length > 0) && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-3 pb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    <Tag className="w-3 h-3" /> #{tag}
                  </span>
                ))}
                {collocations.map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border"
                  >
                    <BookMarked className="w-3 h-3" /> {col}
                  </span>
                ))}
              </div>
            )}

            {/* Vocabulary Info display */}
            <div className="flex-1 flex flex-col space-y-4 mt-4">
              {/* Definitions */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="min-w-0 text-left">
                  {w.definition_en && <p className="leading-relaxed">{w.definition_en}</p>}
                </div>
                <div className="min-w-0 text-right" dir="rtl">
                  {w.translation_ur && (
                    <p className="font-urdu text-xl leading-snug">{w.translation_ur}</p>
                  )}
                </div>
              </div>

              {/* Multiple Context Sentences */}
              {sentences.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                    Usage Examples ({sentences.length})
                  </p>
                  <div className="space-y-3">
                    {sentences.map((sentence, sIdx) => (
                      <div
                        key={sIdx}
                        className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/20 border border-border/60"
                      >
                        <div className="pl-2 border-l-2 border-primary/40 text-left space-y-1">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="w-5 h-5 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                speak(sentence.en || "");
                              }}
                            >
                              <Volume2 className="w-3 h-3 text-muted-foreground" />
                            </Button>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              #{sIdx + 1}
                            </span>
                          </div>
                          {sentence.en && <p className="italic text-sm">"{sentence.en}"</p>}
                        </div>
                        <div className="pr-2 border-r-2 border-primary/40 text-right" dir="rtl">
                          {sentence.ur && (
                            <p className="font-urdu text-lg leading-snug">{sentence.ur}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {w.notes && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Notes
                  </p>
                  <p className="text-sm">{w.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

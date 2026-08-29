import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyRating, type Rating } from "@/lib/srs";
import { speak } from "@/lib/speech";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  RotateCw,
  Check,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Volume2,
  BookOpen,
  Layers,
  Tag,
  BookMarked,
  ArrowRight,
  RefreshCw,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/review")({
  component: ReviewPage,
  head: () => ({ meta: [{ title: "Review — Lafz" }] }),
});

const SWIPE_THRESHOLD = 80; // px to commit a swipe
const STORAGE_LAST_INDEX = "lafz_review_last_index";
const STORAGE_DECK_TYPE = "lafz_review_deck_type";
const STORAGE_MODE = "lafz_review_mode";
const STORAGE_TAG = "lafz_review_tag";

interface ExampleItem {
  en: string;
  ur?: string;
}

function maskWordInSentence(sentence: string, word: string): { masked: string; hasMatch: boolean } {
  if (!sentence || !word) return { masked: sentence, hasMatch: false };
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (regex.test(sentence)) {
    return {
      masked: sentence.replace(regex, "[ _______ ]"),
      hasMatch: true,
    };
  }
  const looseRegex = new RegExp(escaped, "i");
  if (looseRegex.test(sentence)) {
    return {
      masked: sentence.replace(looseRegex, "[ _______ ]"),
      hasMatch: true,
    };
  }
  return { masked: sentence, hasMatch: false };
}

function ReviewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Deck mode: "due" (SRS scheduled) vs "all" (continuous practice of entire library)
  const [deckType, setDeckType] = useState<"due" | "all">(() => {
    try {
      if (typeof window === "undefined") return "all";
      return (localStorage.getItem(STORAGE_DECK_TYPE) as "due" | "all") || "all";
    } catch {
      return "all";
    }
  });

  const [reviewMode, setReviewMode] = useState<"classic" | "cloze">(() => {
    try {
      if (typeof window === "undefined") return "cloze";
      return (localStorage.getItem(STORAGE_MODE) as "classic" | "cloze") || "cloze";
    } catch {
      return "cloze";
    }
  });

  const [selectedTag, setSelectedTag] = useState<string>(() => {
    try {
      if (typeof window === "undefined") return "";
      return localStorage.getItem(STORAGE_TAG) || "";
    } catch {
      return "";
    }
  });

  const [idx, setIdx] = useState<number>(0);
  const [hasResumed, setHasResumed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);

  // Drag / swipe state
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "up" | "down">(null);
  const startY = useRef(0);
  const moved = useRef(false);
  const committingRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  // Fetch all tags for filter
  const { data: allTags } = useQuery({
    queryKey: ["user-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("words").select("tags").limit(300);
      if (error) return [];
      const tagSet = new Set<string>();
      data?.forEach((row) => {
        if (Array.isArray(row.tags)) {
          row.tags.forEach((t) => t && tagSet.add(t.trim().toLowerCase()));
        }
      });
      return Array.from(tagSet).sort();
    },
    staleTime: 60_000,
  });

  // Fetch words based on deck type and tag
  const { data: words, isLoading } = useQuery({
    queryKey: ["review-words", deckType, selectedTag],
    queryFn: async () => {
      let query = supabase.from("words").select("*");

      if (deckType === "due") {
        query = query.lte("due_at", new Date().toISOString());
      }

      if (selectedTag.trim()) {
        query = query.contains("tags", [selectedTag.trim().toLowerCase()]);
      }

      const { data, error } = await query
        .order(deckType === "due" ? "due_at" : "created_at", { ascending: deckType === "due" })
        .limit(200);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Save current position and deck preferences
  const updateDeckType = (type: "due" | "all") => {
    setDeckType(type);
    setIdx(0);
    setFlipped(false);
    try {
      localStorage.setItem(STORAGE_DECK_TYPE, type);
      localStorage.setItem(STORAGE_LAST_INDEX, "0");
    } catch {}
  };

  const updateReviewMode = (mode: "classic" | "cloze") => {
    setReviewMode(mode);
    try {
      localStorage.setItem(STORAGE_MODE, mode);
    } catch {}
  };

  const updateSelectedTag = (tag: string) => {
    setSelectedTag(tag);
    setIdx(0);
    setFlipped(false);
    try {
      localStorage.setItem(STORAGE_TAG, tag);
      localStorage.setItem(STORAGE_LAST_INDEX, "0");
    } catch {}
  };

  // Auto-resume from last saved position once words are loaded
  useEffect(() => {
    if (words && words.length > 0 && !hasResumed) {
      try {
        const saved = localStorage.getItem(STORAGE_LAST_INDEX);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < words.length) {
            setIdx(parsed);
            if (parsed > 0) {
              toast.info(`Resumed at word #${parsed + 1} of ${words.length}`, {
                duration: 2500,
              });
            }
          }
        }
      } catch {}
      setHasResumed(true);
    }
  }, [words, hasResumed]);

  const setCardIndex = useCallback(
    (newIdx: number) => {
      if (!words || words.length === 0) return;
      const clamped = Math.max(0, Math.min(words.length - 1, newIdx));
      setIdx(clamped);
      setFlipped(false);
      try {
        localStorage.setItem(STORAGE_LAST_INDEX, String(clamped));
      } catch {}
    },
    [words],
  );

  const current = words?.[idx];

  const currentSentences = useMemo<ExampleItem[]>(() => {
    if (!current) return [];
    if (Array.isArray(current.examples) && current.examples.length > 0) {
      return current.examples as ExampleItem[];
    }
    if (current.example_en || current.example_ur) {
      return [{ en: current.example_en || "", ur: current.example_ur || "" }];
    }
    return [];
  }, [current]);

  const primarySentence = currentSentences[0];
  const cloze = useMemo(() => {
    if (!current || !primarySentence?.en) return null;
    return maskWordInSentence(primarySentence.en, current.word);
  }, [current, primarySentence]);

  const commitRating = async (rating: Rating) => {
    if (!current) return;
    try {
      const next = applyRating(
        {
          ease: Number(current.ease),
          interval_days: current.interval_days,
          repetitions: current.repetitions,
          due_at: current.due_at,
          mastered: current.mastered,
        },
        rating,
      );

      const userId = userIdRef.current;

      await Promise.all([
        supabase
          .from("words")
          .update({
            ease: next.ease,
            interval_days: next.interval_days,
            repetitions: next.repetitions,
            due_at: next.due_at,
            mastered: next.mastered,
            last_reviewed_at: new Date().toISOString(),
          })
          .eq("id", current.id),
        userId &&
          supabase.from("reviews").insert({
            user_id: userId,
            word_id: current.id,
            rating,
          }),
      ]);

      updateStreak(userId).catch((err) =>
        console.error("Streak update failed (non-blocking):", err),
      );

      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("Failed to save review");
    }
  };

  const advanceWith = async (rating: Rating, dir: "up" | "down") => {
    if (committingRef.current || !words) return;
    committingRef.current = true;

    setExiting(dir);
    try {
      await commitRating(rating);
    } catch {}

    window.setTimeout(() => {
      setSessionReviewed((r) => r + 1);
      setFlipped(false);
      setDragY(0);
      setExiting(null);

      const next = idx + 1;
      setIdx(next);
      try {
        localStorage.setItem(STORAGE_LAST_INDEX, String(next));
      } catch {}
      committingRef.current = false;
    }, 220);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowUp" || e.key === "1") {
        e.preventDefault();
        advanceWith("good", "up");
      } else if (e.key === "ArrowDown" || e.key === "2") {
        e.preventDefault();
        advanceWith("again", "down");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (words && idx < words.length - 1) setCardIndex(idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (idx > 0) setCardIndex(idx - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [idx, words, setCardIndex]);

  // Touch pointer handlers for card swipe
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
    if (Math.abs(dy) > 5) moved.current = true;
    setDragY(dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {}

    const dy = dragY;
    if (!moved.current) {
      setFlipped((f) => !f);
      setDragY(0);
      return;
    }

    if (dy <= -SWIPE_THRESHOLD) {
      advanceWith("good", "up"); // Swiped Up -> Good
    } else if (dy >= SWIPE_THRESHOLD) {
      advanceWith("again", "down"); // Swiped Down -> Again
    } else {
      setDragY(0);
    }
  };

  if (isLoading) return <LoadingScreen />;

  const totalCount = words?.length ?? 0;
  const isFinished = !words || totalCount === 0 || idx >= totalCount;

  // Deck completion view
  if (isFinished) {
    return (
      <div className="space-y-4 max-w-xl mx-auto pb-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-semibold">Review</h1>
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => updateDeckType("all")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                deckType === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              All Library
            </button>
            <button
              type="button"
              onClick={() => updateDeckType("due")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                deckType === "due" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Due Only
            </button>
          </div>
        </header>

        <Card className="p-8 sm:p-10 text-center shadow-card rounded-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto text-success">
            <Check className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {deckType === "due" ? "Due queue finished! 🎉" : "Deck completed! 🎉"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {sessionReviewed > 0
                ? `You reviewed ${sessionReviewed} word${sessionReviewed > 1 ? "s" : ""} in this session.`
                : "No cards pending in this deck."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setCardIndex(0);
                setSessionReviewed(0);
              }}
              className="gap-1.5 font-medium"
            >
              <RefreshCw className="w-4 h-4" /> Restart Deck (from #1)
            </Button>
            <Button
              size="lg"
              onClick={() => {
                updateDeckType(deckType === "due" ? "all" : "due");
              }}
              className="gap-1.5 font-medium"
            >
              {deckType === "due" ? "Practice All Words" : "Review Due Words"}
            </Button>
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate({ to: "/words" })}
              className="hover:underline text-primary"
            >
              Browse Words List →
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => navigate({ to: "/quiz" })}
              className="hover:underline text-primary"
            >
              Take a Quiz →
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const translateY = exiting === "up" ? -800 : exiting === "down" ? 800 : dragY;
  const rotate = (translateY / 30).toFixed(2);
  const opacity = exiting ? 0 : Math.max(0.4, 1 - Math.abs(dragY) / 400);

  const showUpHint = dragY < -20;
  const showDownHint = dragY > 20;

  const currentTags = Array.isArray(current.tags) ? current.tags : [];
  const currentCols = Array.isArray(current.collocations) ? current.collocations : [];

  return (
    <div className="space-y-3 max-w-xl mx-auto pb-4 overflow-hidden">
      {/* Top Header with Deck & Mode Switchers */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold">Review</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="font-semibold text-foreground">Word #{idx + 1}</span> of {totalCount} ·{" "}
            <span className="text-primary font-medium">{sessionReviewed} reviewed today</span>
          </p>
        </div>

        {/* Deck Mode Toggle (All vs Due) */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
          <button
            type="button"
            onClick={() => updateDeckType("all")}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors",
              deckType === "all" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            title="Review all words continuously in sequence"
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => updateDeckType("due")}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors",
              deckType === "due" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            title="Review only words due by spaced repetition"
          >
            Due
          </button>
        </div>
      </header>

      {/* Live Deck Progress Bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((idx + 1) / Math.max(1, totalCount)) * 100}%` }}
          />
        </div>
      </div>

      {/* Mode & Tag Filters */}
      <div className="flex items-center justify-between gap-2 text-xs">
        {/* Cloze vs Flashcard Mode Toggle */}
        <div className="flex items-center rounded-lg bg-muted/70 p-0.5 border border-border">
          <button
            type="button"
            onClick={() => updateReviewMode("cloze")}
            className={cn(
              "px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1",
              reviewMode === "cloze"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="w-3.5 h-3.5" /> Sentence Cloze
          </button>
          <button
            type="button"
            onClick={() => updateReviewMode("classic")}
            className={cn(
              "px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1",
              reviewMode === "classic"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers className="w-3.5 h-3.5" /> Flashcard
          </button>
        </div>

        {/* Tag filter pills */}
        {allTags && allTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => updateSelectedTag("")}
              className={cn(
                "px-2 py-0.5 rounded-full font-medium transition-colors shrink-0",
                !selectedTag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              All Tags
            </button>
            {allTags.slice(0, 4).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateSelectedTag(t === selectedTag ? "" : t)}
                className={cn(
                  "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-medium transition-colors shrink-0 border",
                  selectedTag === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground",
                )}
              >
                <Tag className="w-2.5 h-2.5" /> #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Flashcard Container */}
      <div
        className="relative touch-none select-none"
        style={{
          height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 15rem)",
          minHeight: 360,
        }}
      >
        {/* Swipe Hints */}
        <div
          className={`pointer-events-none absolute inset-x-0 -top-2 flex justify-center transition-opacity z-20 ${showUpHint ? "opacity-100" : "opacity-0"}`}
        >
          <div className="bg-success text-success-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 shadow-card">
            <ChevronUp className="w-3.5 h-3.5" /> I know it (Good)
          </div>
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center transition-opacity z-20 ${showDownHint ? "opacity-100" : "opacity-0"}`}
        >
          <div className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 shadow-card">
            <ChevronDown className="w-3.5 h-3.5" /> Study again
          </div>
        </div>

        {/* Card Body */}
        <Card
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="h-full w-full p-5 sm:p-7 flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing shadow-elevated select-none touch-none overflow-y-auto rounded-2xl border-border bg-card relative"
          style={{
            transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
            opacity,
            transition: dragging ? "none" : "transform 220ms ease, opacity 220ms ease",
          }}
        >
          {!flipped ? (
            /* FRONT OF CARD */
            reviewMode === "cloze" && cloze ? (
              <div className="space-y-4 max-w-md my-auto">
                <span className="text-[11px] uppercase tracking-wider font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                  Sentence in Context
                </span>
                <p className="text-xl sm:text-2xl font-serif leading-relaxed px-2 text-foreground">
                  "{cloze.masked}"
                </p>
                {primarySentence?.ur && (
                  <p className="font-urdu text-xl sm:text-2xl text-muted-foreground pt-1 leading-relaxed" dir="rtl">
                    {primarySentence.ur}
                  </p>
                )}
                {current.part_of_speech && (
                  <p className="text-xs text-muted-foreground italic font-mono">({current.part_of_speech})</p>
                )}
                <div className="pt-3">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 bg-muted/40 py-1.5 px-3 rounded-full mx-auto w-fit">
                    <RotateCw className="w-3 h-3" /> Tap card to reveal target word
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 my-auto">
                <Sparkles className="w-7 h-7 text-primary mx-auto opacity-80" />
                <p className="text-3xl sm:text-4xl font-display font-bold text-foreground">{current.word}</p>
                {current.part_of_speech && (
                  <p className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-block">
                    {current.part_of_speech}
                  </p>
                )}
                {currentTags.length > 0 && (
                  <div className="flex justify-center gap-1 pt-1">
                    {currentTags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[11px] text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 bg-muted/40 py-1.5 px-3 rounded-full mx-auto w-fit">
                    <RotateCw className="w-3 h-3" /> Tap card to reveal meaning
                  </p>
                </div>
              </div>
            )
          ) : (
            /* BACK OF CARD */
            <div className="space-y-3.5 w-full max-w-md my-auto">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl sm:text-4xl font-display font-bold text-primary">
                  {current.word}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-muted/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(current.word);
                  }}
                  title="Pronounce word"
                >
                  <Volume2 className="w-4 h-4 text-foreground" />
                </Button>
              </div>

              {(current.one_word_en || current.one_word_ur) && (
                <div className="flex flex-wrap justify-center items-center gap-2">
                  {current.one_word_en && (
                    <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-sm font-semibold">
                      = {current.one_word_en}
                    </span>
                  )}
                  {current.one_word_ur && (
                    <span
                      className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-urdu text-lg font-medium"
                      dir="rtl"
                    >
                      = {current.one_word_ur}
                    </span>
                  )}
                </div>
              )}

              {current.translation_ur && (
                <p className="font-urdu text-xl sm:text-2xl text-foreground font-medium leading-relaxed" dir="rtl">
                  {current.translation_ur}
                </p>
              )}

              {current.definition_en && (
                <p className="text-sm text-muted-foreground leading-relaxed px-1">
                  {current.definition_en}
                </p>
              )}

              {/* Collocations preview */}
              {currentCols.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 py-0.5 text-xs">
                  {currentCols.slice(0, 2).map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]"
                    >
                      <BookMarked className="w-2.5 h-2.5 opacity-70" /> {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Sentence Audio & Phrasing */}
              {primarySentence?.en && (
                <div className="p-3 rounded-xl bg-muted/30 text-left border border-border/70 space-y-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                      Example
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="w-5 h-5 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(primarySentence.en || "");
                      }}
                    >
                      <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-sm italic font-serif">"{primarySentence.en}"</p>
                  {primarySentence.ur && (
                    <p className="font-urdu text-base text-right pt-0.5 leading-relaxed" dir="rtl">
                      {primarySentence.ur}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Controls / SRS Rating Buttons */}
      <div className="space-y-2 pt-1">
        {flipped && !exiting ? (
          <div className="grid grid-cols-4 gap-2">
            <RateBtn
              label="Again"
              sub="< 10m"
              color="bg-destructive text-destructive-foreground"
              onClick={() => advanceWith("again", "down")}
            />
            <RateBtn
              label="Hard"
              sub="1d"
              color="bg-warning text-warning-foreground"
              onClick={() => advanceWith("hard", "down")}
            />
            <RateBtn
              label="Good"
              sub="3d+"
              color="bg-primary text-primary-foreground"
              onClick={() => advanceWith("good", "up")}
            />
            <RateBtn
              label="Easy"
              sub="long"
              color="bg-success text-success-foreground"
              onClick={() => advanceWith("easy", "up")}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={idx === 0}
              onClick={() => setCardIndex(idx - 1)}
              className="h-11 text-xs sm:text-sm font-medium"
            >
              Previous
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={() => setFlipped((f) => !f)}
              className="h-11 text-xs sm:text-sm font-medium gap-1"
            >
              <RotateCw className="w-3.5 h-3.5" /> Flip Card
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={idx >= totalCount - 1}
              onClick={() => setCardIndex(idx + 1)}
              className="h-11 text-xs sm:text-sm font-medium"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RateBtn({
  label,
  sub,
  color,
  onClick,
}: {
  label: string;
  sub: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${color} rounded-xl py-2.5 px-1 font-medium text-xs sm:text-sm shadow-card active:scale-95 transition cursor-pointer`}
    >
      <div>{label}</div>
      <div className="text-[10px] opacity-80 mt-0.5 font-mono">{sub}</div>
    </button>
  );
}

async function updateStreak(userId: string | null) {
  if (!userId) return;
  const { data: prof } = await supabase
    .from("profiles")
    .select("current_streak,longest_streak,last_study_date")
    .eq("id", userId)
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  if (prof?.last_study_date === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = prof?.last_study_date === yesterday ? (prof.current_streak ?? 0) + 1 : 1;
  await supabase
    .from("profiles")
    .update({
      current_streak: streak,
      longest_streak: Math.max(streak, prof?.longest_streak ?? 0),
      last_study_date: today,
    })
    .eq("id", userId);
}

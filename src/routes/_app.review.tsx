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
import {
  FormalityRegister,
  PermanentCategory,
  CATEGORY_CONFIG,
  REGISTER_CONFIG,
  extractFormalitySpectrum,
} from "@/lib/formality";
import { FormalitySpectrum } from "@/components/FormalitySpectrum";
import { UpgradeFormalityModal } from "@/components/UpgradeFormalityModal";

export const Route = createFileRoute("/_app/review")({
  component: ReviewPage,
  head: () => ({ meta: [{ title: "Review — Lafz" }] }),
});

const SWIPE_THRESHOLD = 80; // px to commit a swipe
const STORAGE_LAST_INDEX = "lafz_review_last_index";
const STORAGE_DECK_TYPE = "lafz_review_deck_type";
const STORAGE_MODE = "lafz_review_mode";
const STORAGE_REGISTER = "lafz_review_register";

interface ExampleItem {
  en: string;
  ur?: string;
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

  // 3 Permanent Situation Categories ("all" | "daily-life" | "workplace" | "news-reading")
  const [selectedCategory, setSelectedCategory] = useState<"all" | PermanentCategory>(() => {
    try {
      if (typeof window === "undefined") return "all";
      const saved = localStorage.getItem(STORAGE_REGISTER);
      if (saved === "daily-life" || saved === "workplace" || saved === "news-reading") return saved;
      if (saved === "informal") return "daily-life";
      if (saved === "neutral") return "workplace";
      if (saved === "formal") return "news-reading";
      return "all";
    } catch {
      return "all";
    }
  });

  const [idx, setIdx] = useState<number>(0);
  const [hasResumed, setHasResumed] = useState(false);
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

  // Fetch words based on deck type
  const { data: rawWords, isLoading } = useQuery({
    queryKey: ["review-words", deckType],
    queryFn: async () => {
      let query = supabase.from("words").select("*");

      if (deckType === "due") {
        query = query.lte("due_at", new Date().toISOString());
      }

      const { data, error } = await query
        .order(deckType === "due" ? "due_at" : "created_at", { ascending: deckType === "due" })
        .limit(300);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Calculate situation category counts
  const categoryCounts = useMemo(() => {
    if (!rawWords) return { all: 0, "daily-life": 0, workplace: 0, "news-reading": 0 };
    const counts = { all: rawWords.length, "daily-life": 0, workplace: 0, "news-reading": 0 };
    rawWords.forEach((w) => {
      const cat = extractFormalitySpectrum(w).category;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [rawWords]);

  // Filter words by active Situation Category
  const words = useMemo(() => {
    if (!rawWords) return [];
    if (selectedCategory === "all") return rawWords;
    return rawWords.filter((w) => extractFormalitySpectrum(w).category === selectedCategory);
  }, [rawWords, selectedCategory]);

  // Save current position and deck preferences
  const updateDeckType = (type: "due" | "all") => {
    setDeckType(type);
    setIdx(0);
    try {
      localStorage.setItem(STORAGE_DECK_TYPE, type);
      localStorage.setItem(STORAGE_LAST_INDEX, "0");
    } catch {}
  };

  const updateSelectedCategory = (cat: "all" | PermanentCategory) => {
    setSelectedCategory(cat);
    setIdx(0);
    try {
      localStorage.setItem(STORAGE_REGISTER, cat);
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
        if (current?.word) speak(current.word);
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
  }, [idx, words, current, setCardIndex]);

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
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-display font-semibold">Review</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sessionReviewed > 0
                ? `${sessionReviewed} cards reviewed in this session`
                : "No cards pending in this deck"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <UpgradeFormalityModal />
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => updateDeckType("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  deckType === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => updateDeckType("due")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  deckType === "due" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                Due
              </button>
            </div>
          </div>
        </header>

        {/* 3 Permanent Situation Category Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => updateSelectedCategory("all")}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            All ({categoryCounts.all})
          </button>

          <button
            type="button"
            onClick={() => updateSelectedCategory("daily-life")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
              selectedCategory === "daily-life"
                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <span>🏠 Daily Life</span>
            <span className="text-[10px] opacity-75 font-mono">({categoryCounts["daily-life"]})</span>
          </button>

          <button
            type="button"
            onClick={() => updateSelectedCategory("workplace")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
              selectedCategory === "workplace"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <span>💼 Workplace</span>
            <span className="text-[10px] opacity-75 font-mono">({categoryCounts.workplace})</span>
          </button>

          <button
            type="button"
            onClick={() => updateSelectedCategory("news-reading")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
              selectedCategory === "news-reading"
                ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <span>📰 News Reading</span>
            <span className="text-[10px] opacity-75 font-mono">({categoryCounts["news-reading"]})</span>
          </button>
        </div>

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
                : "No cards pending in this category."}
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

  const currentCols = Array.isArray(current.collocations) ? current.collocations : [];
  const spectrum = extractFormalitySpectrum(current);

  return (
    <div className="space-y-3 max-w-xl mx-auto pb-4 overflow-hidden">
      {/* Top Header with Deck, Formality Upgrade, & Mode Switchers */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold">Review</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="font-semibold text-foreground">Word #{idx + 1}</span> of {totalCount} ·{" "}
            <span className="text-primary font-medium">{sessionReviewed} reviewed today</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <UpgradeFormalityModal />
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
              All
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

      {/* 3 Permanent Situation Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
        <button
          type="button"
          onClick={() => updateSelectedCategory("all")}
          className={cn(
            "px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          All ({categoryCounts.all})
        </button>

        <button
          type="button"
          onClick={() => updateSelectedCategory("daily-life")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            selectedCategory === "daily-life"
              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>🏠 Daily Life</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts["daily-life"]})</span>
        </button>

        <button
          type="button"
          onClick={() => updateSelectedCategory("workplace")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            selectedCategory === "workplace"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>💼 Workplace</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts.workplace})</span>
        </button>

        <button
          type="button"
          onClick={() => updateSelectedCategory("news-reading")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            selectedCategory === "news-reading"
              ? "bg-sky-600 text-white border-sky-600 shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>📰 News Reading</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts["news-reading"]})</span>
        </button>
      </div>

      {/* Main Flashcard Container */}
      <div
        className="relative touch-none select-none"
        style={{
          height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 18rem)",
          minHeight: 340,
          maxHeight: 520,
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
          className="h-full w-full p-3.5 sm:p-4.5 flex flex-col justify-start items-stretch text-center cursor-grab active:cursor-grabbing shadow-elevated select-none touch-none overflow-y-auto rounded-2xl border-border bg-card relative scrollbar-none"
          style={{
            transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
            opacity,
            transition: dragging ? "none" : "transform 220ms ease, opacity 220ms ease",
          }}
        >
          {/* DEFAULT CARD DETAILS: FULL USAGE SPECTRUM & MEANING */}
          <div className="space-y-2.5 sm:space-y-3 w-full max-w-md mx-auto my-auto py-0.5">
            {/* Category Badge Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border",
                  CATEGORY_CONFIG[spectrum.category]?.colorBadge || "bg-primary/10 text-primary"
                )}
              >
                {CATEGORY_CONFIG[spectrum.category]?.label}
              </span>

              {current.one_word_en && (
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {current.one_word_en}
                </span>
              )}
            </div>

            {/* Hero Row: English Word + Audio on Left, Urdu 1-Word on Right */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <p className="text-3xl sm:text-4xl font-display font-bold text-primary tracking-tight text-left">
                  {current.word}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(current.word);
                  }}
                  className="w-8 h-8 rounded-full bg-muted/60 hover:bg-primary/15 text-muted-foreground hover:text-primary flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  title="Pronounce word"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {current.one_word_ur && (
                <p className="font-urdu text-2xl sm:text-3xl font-bold text-primary leading-none text-right shrink-0" dir="rtl">
                  {current.one_word_ur}
                </p>
              )}
            </div>

            {/* Urdu Definition */}
            {current.translation_ur && (
              <p className="font-urdu text-base sm:text-lg text-foreground/90 font-medium leading-relaxed px-1 text-right pt-0.5" dir="rtl">
                {current.translation_ur}
              </p>
            )}

            {/* 3-Tier Usage Spectrum Bridge Component */}
            <FormalitySpectrum data={spectrum} headword={current.word} />

            {/* Sentence Audio & Phrasing */}
            {primarySentence?.en && (
              <div className="p-2 sm:p-2.5 rounded-xl bg-muted/30 text-left border border-border/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                    Example Dialogue
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
                    title="Pronounce sentence"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <p className="text-xs sm:text-sm italic font-serif text-foreground">"{primarySentence.en}"</p>
                {primarySentence.ur && (
                  <p className="font-urdu text-sm text-muted-foreground text-right pt-0.5 leading-relaxed" dir="rtl">
                    {primarySentence.ur}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Controls / SRS Rating & Navigation Buttons */}
      <div className="space-y-2 pt-1 pb-2">
        {/* Direct 4 SRS Rating Buttons */}
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

        {/* Previous & Next Navigation Row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            disabled={idx === 0}
            onClick={() => setCardIndex(idx - 1)}
            className="h-8 text-xs font-semibold shadow-sm cursor-pointer"
          >
            ← Previous
          </Button>

          <span className="text-[11px] text-muted-foreground font-medium">
            Swipe up (Good) · down (Again)
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={idx >= totalCount - 1}
            onClick={() => setCardIndex(idx + 1)}
            className="h-8 text-xs font-semibold shadow-sm cursor-pointer"
          >
            Next →
          </Button>
        </div>
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

  const now = new Date();
  const today = now.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
  if (prof?.last_study_date === today) return;

  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterday = yesterdayDate.toLocaleDateString("en-CA");
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

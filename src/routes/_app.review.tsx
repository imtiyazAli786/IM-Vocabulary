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
  Check,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Volume2,
  BookOpen,
  Eye,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PermanentCategory,
  CATEGORY_CONFIG,
  extractFormalitySpectrum,
} from "@/lib/formality";
import { FormalitySpectrum } from "@/components/FormalitySpectrum";

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
  const [isRevealed, setIsRevealed] = useState(false);

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
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
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
    setIsRevealed(false);
    try {
      localStorage.setItem(STORAGE_DECK_TYPE, type);
      localStorage.setItem(STORAGE_LAST_INDEX, "0");
    } catch {}
  };

  const updateSelectedCategory = (cat: "all" | PermanentCategory) => {
    setSelectedCategory(cat);
    setIdx(0);
    setIsRevealed(false);
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
      setIsRevealed(false);
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

  const advanceWith = async (rating: Rating) => {
    if (committingRef.current || !words) return;
    committingRef.current = true;

    try {
      await commitRating(rating);
    } catch {}

    setSessionReviewed((r) => r + 1);
    setIsRevealed(false);

    const next = idx + 1;
    setIdx(next);
    try {
      localStorage.setItem(STORAGE_LAST_INDEX, String(next));
    } catch {}
    committingRef.current = false;
  };

  // Touch Swipe Gesture handlers for mobile flashcards
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Vertical swipe takes priority when deltaY is dominant (Instagram Reels / TikTok habit: Up for Next, Down for Previous)
    if (Math.abs(deltaY) > 50 && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
      if (deltaY < 0) {
        // Swiped Up (↑) -> Next Word
        if (words && idx < words.length - 1) {
          advanceWith("good");
        }
      } else {
        // Swiped Down (↓) -> Previous Word
        if (idx > 0) {
          setCardIndex(idx - 1);
        }
      }
    } else if (Math.abs(deltaX) > 50) {
      // Horizontal swipe (Tinder style: Right for Good, Left for Again)
      if (deltaX > 0) {
        if (!isRevealed) {
          setIsRevealed(true);
        } else {
          advanceWith("good");
        }
      } else {
        if (!isRevealed) {
          setIsRevealed(true);
        } else {
          advanceWith("again");
        }
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Keyboard navigation safely guarded
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          document.querySelector("[role='dialog']"))
      ) {
        return;
      }

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isRevealed) {
          setIsRevealed(true);
        } else {
          // Standard Anki convention: Spacebar on revealed card grades "Good"
          advanceWith("good");
        }
      } else if (e.key.toLowerCase() === "r" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (current?.word) speak(current.word);
      } else if (e.key === "1") {
        e.preventDefault();
        if (isRevealed) advanceWith("again");
      } else if (e.key === "2") {
        e.preventDefault();
        if (isRevealed) advanceWith("hard");
      } else if (e.key === "3") {
        e.preventDefault();
        if (isRevealed) advanceWith("good");
      } else if (e.key === "4") {
        e.preventDefault();
        if (isRevealed) advanceWith("easy");
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
  }, [idx, words, current, isRevealed, setCardIndex]);

  if (isLoading && (!rawWords || rawWords.length === 0)) {
    return (
      <div className="space-y-3 pb-6 max-w-xl mx-auto">
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-display font-semibold">Review</h1>
        </header>
        <div className="w-full p-8 rounded-2xl border border-border/70 bg-card/60 animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-32 mx-auto" />
          <div className="h-10 bg-muted/80 rounded w-48 mx-auto" />
          <div className="h-4 bg-muted/50 rounded w-24 mx-auto" />
          <div className="h-28 bg-muted/30 rounded-xl w-full mt-4" />
        </div>
      </div>
    );
  }

  // 1. Empty State for Brand New Library (applies whether due or all was selected)
  if (!rawWords || rawWords.length === 0) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-semibold">Review</h1>
        </header>
        <Card className="p-8 sm:p-10 text-center shadow-card rounded-2xl space-y-4 border-dashed">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Your library is empty
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Add your first word or import a vocabulary list to start reviewing with spaced repetition.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
            <Button onClick={() => navigate({ to: "/words/add" })} className="gap-1.5 font-medium">
              <Sparkles className="w-4 h-4" /> Add your first word
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/import" })}>
              Import vocabulary
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const totalCount = words?.length ?? 0;

  // 2. Queue Completed State
  if (totalCount === 0 || (words && idx >= totalCount)) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold">Review</h1>
            <p className="text-xs text-muted-foreground">Session Complete</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => updateDeckType("all")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                deckType === "all" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => updateDeckType("due")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                deckType === "due" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Due
            </button>
          </div>
        </header>

        {/* 3 Permanent Situation Category Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => updateSelectedCategory("all")}
            aria-pressed={selectedCategory === "all"}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/20 font-semibold"
                : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            All ({categoryCounts.all})
          </button>

          <button
            type="button"
            onClick={() => updateSelectedCategory("daily-life")}
            aria-pressed={selectedCategory === "daily-life"}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
              selectedCategory === "daily-life"
                ? CATEGORY_CONFIG["daily-life"].colorActivePill
                : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <span>🏠 Daily Life</span>
            <span className="text-[10px] opacity-75 font-mono">({categoryCounts["daily-life"]})</span>
          </button>

          <button
            type="button"
            onClick={() => updateSelectedCategory("workplace")}
            aria-pressed={selectedCategory === "workplace"}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
              selectedCategory === "workplace"
                ? CATEGORY_CONFIG.workplace.colorActivePill
                : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <span>💼 Workplace</span>
            <span className="text-[10px] opacity-75 font-mono">({categoryCounts.workplace})</span>
          </button>

          <button
            type="button"
            onClick={() => updateSelectedCategory("news-reading")}
            aria-pressed={selectedCategory === "news-reading"}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
              selectedCategory === "news-reading"
                ? CATEGORY_CONFIG["news-reading"].colorActivePill
                : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
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
              {deckType === "due" ? "All caught up on due reviews! 🎉" : "Deck completed! 🎉"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {sessionReviewed > 0
                ? `You reviewed ${sessionReviewed} word${sessionReviewed > 1 ? "s" : ""} in this session.`
                : "No cards pending in this category."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {totalCount > 0 && (
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
            )}
            <Button
              size="lg"
              onClick={() => {
                updateDeckType(deckType === "due" ? "all" : "due");
              }}
              className={cn("gap-1.5 font-medium", totalCount === 0 && "sm:col-span-2")}
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

  if (!current) return null;

  const spectrum = extractFormalitySpectrum(current);

  return (
    <div className="space-y-2.5 max-w-xl mx-auto pb-1 flex-1 flex flex-col justify-between">
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
              "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
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
              "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
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

      {/* 3 Permanent Situation Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
        <button
          type="button"
          onClick={() => updateSelectedCategory("all")}
          aria-pressed={selectedCategory === "all"}
          className={cn(
            "px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/20 font-semibold"
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          All ({categoryCounts.all})
        </button>

        <button
          type="button"
          onClick={() => updateSelectedCategory("daily-life")}
          aria-pressed={selectedCategory === "daily-life"}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            selectedCategory === "daily-life"
              ? CATEGORY_CONFIG["daily-life"].colorActivePill
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>🏠 Daily Life</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts["daily-life"]})</span>
        </button>

        <button
          type="button"
          onClick={() => updateSelectedCategory("workplace")}
          aria-pressed={selectedCategory === "workplace"}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            selectedCategory === "workplace"
              ? CATEGORY_CONFIG.workplace.colorActivePill
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>💼 Workplace</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts.workplace})</span>
        </button>

        <button
          type="button"
          onClick={() => updateSelectedCategory("news-reading")}
          aria-pressed={selectedCategory === "news-reading"}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            selectedCategory === "news-reading"
              ? CATEGORY_CONFIG["news-reading"].colorActivePill
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>📰 News Reading</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts["news-reading"]})</span>
        </button>
      </div>

      {/* Main Flashcard Container & Thumb-Accessible Controls */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 flex flex-col justify-between gap-2.5 select-none touch-pan-y"
      >
        <Card
          className="w-full p-4 sm:p-5 shadow-elevated rounded-2xl border-border bg-card transition-all duration-200 flex-1 flex flex-col justify-between min-h-[380px] sm:min-h-[420px]"
        >
          <div className="space-y-3 w-full max-w-md mx-auto flex-1 flex flex-col justify-between">
          {/* Category & Register Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border",
                  CATEGORY_CONFIG[spectrum.category]?.colorBadge || "bg-primary/10 text-primary"
                )}
              >
                {CATEGORY_CONFIG[spectrum.category]?.shortLabel || "Category"}
              </span>
              {current.part_of_speech && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {current.part_of_speech}
                </span>
              )}
            </div>

            {isRevealed && current.one_word_en && (
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {current.one_word_en}
              </span>
            )}
          </div>

          {/* Prompt Row: English Headword + Pronunciation Audio */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <p className="text-3xl sm:text-4xl font-display font-bold text-primary tracking-tight text-left">
                {current.word}
              </p>
              <button
                type="button"
                onClick={() => speak(current.word)}
                aria-label={`Pronounce ${current.word}`}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-muted/60 hover:bg-primary/15 text-muted-foreground hover:text-primary flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="Pronounce word"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            {/* Revealed: One-Word Urdu or Primary Translation */}
            {isRevealed && (current.one_word_ur || current.translation_ur) && (
              <p className="font-urdu text-2xl sm:text-3xl font-bold text-primary leading-[1.8] text-right shrink-0 py-0.5" dir="rtl">
                {current.one_word_ur || current.translation_ur}
              </p>
            )}
          </div>

          {/* ACTIVE RECALL: UNREVEALED PROMPT VS REVEALED ANSWER */}
          {!isRevealed ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsRevealed(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsRevealed(true);
                }
              }}
              aria-label="Reveal answer"
              className="my-3 py-10 cursor-pointer flex flex-col items-center justify-center space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shadow-sm">
                <Eye className="w-5 h-5" />
              </div>
              <div className="text-center px-4">
                <p className="font-semibold text-sm sm:text-base text-foreground">
                  Tap to Reveal Answer
                </p>
                <p className="text-sm sm:text-base text-muted-foreground mt-0.5 font-urdu leading-[1.8]" dir="rtl">
                  معنی، ترجمہ اور استعمال دیکھیں
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono bg-card px-2.5 py-0.5 rounded border border-border/80">
                Press Space ␣
              </span>
            </div>
          ) : (
            /* REVEALED CONTENT */
            <div className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
              {/* Full Urdu Translation (if distinct from one_word_ur) */}
              {current.translation_ur && current.one_word_ur && current.translation_ur !== current.one_word_ur && (
                <div className="p-3 rounded-xl bg-card border border-border/70 text-right" dir="rtl">
                  <p className="font-urdu text-base sm:text-lg text-foreground font-medium leading-relaxed">
                    {current.translation_ur}
                  </p>
                </div>
              )}

              {/* Notice if no Urdu translation is stored yet */}
              {!current.one_word_ur && !current.translation_ur && (
                <div className="p-3 rounded-xl bg-muted/30 border border-dashed border-border/80 text-center">
                  <p className="text-xs text-muted-foreground">
                    No Urdu translation added yet for this word.
                  </p>
                </div>
              )}

              {/* 3-Tier Usage Spectrum Bridge */}
              <FormalitySpectrum data={spectrum} headword={current.word} />

              {/* Example Dialogue */}
              {primarySentence?.en && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-muted/30 text-left border border-border/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                      Example Dialogue
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="w-5 h-5 rounded-full"
                      onClick={() => speak(primarySentence.en || "")}
                      aria-label="Pronounce example sentence"
                      title="Pronounce sentence"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm italic font-serif text-foreground">
                    "{primarySentence.en}"
                  </p>
                  {primarySentence.ur && (
                    <p className="font-urdu text-sm text-muted-foreground text-right pt-0.5 leading-relaxed" dir="rtl">
                      {primarySentence.ur}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Bottom Controls / SRS Rating & Navigation */}
      <div className="space-y-2 pt-1 pb-2">
        {!isRevealed ? (
          /* When unrevealed: Single clear action button */
          <Button
            size="lg"
            onClick={() => setIsRevealed(true)}
            className="w-full h-12 text-sm font-semibold gap-2 shadow-card cursor-pointer"
          >
            <Eye className="w-4 h-4" /> Show Answer (Space)
          </Button>
        ) : (
          /* When revealed: 4 SRS Rating Buttons */
          <div className="grid grid-cols-4 gap-2 animate-in fade-in-50 duration-200">
            <RateBtn
              label="Again"
              sub="< 10m [1]"
              color="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => advanceWith("again")}
            />
            <RateBtn
              label="Hard"
              sub="1d [2]"
              color="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => advanceWith("hard")}
            />
            <RateBtn
              label="Good"
              sub="3d+ [3]"
              color="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => advanceWith("good")}
            />
            <RateBtn
              label="Easy"
              sub="long [4]"
              color="bg-success text-success-foreground hover:bg-success/90"
              onClick={() => advanceWith("easy")}
            />
          </div>
        )}

        {/* Previous & Next Navigation Row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            disabled={idx === 0}
            onClick={() => setCardIndex(idx - 1)}
            className="h-8 text-xs font-semibold shadow-sm cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
          </Button>

          <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
            Keys: Space (Reveal) · 1-4 (Rate) · ← / →
          </span>
          <span className="text-[11px] text-muted-foreground font-medium sm:hidden">
            Swipe: 👆 Next · 👇 Prev
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={idx >= totalCount - 1}
            onClick={() => setCardIndex(idx + 1)}
            className="h-8 text-xs font-semibold shadow-sm cursor-pointer"
          >
            Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
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
      type="button"
      onClick={onClick}
      className={`${color} rounded-xl py-2 px-1 font-medium text-xs sm:text-sm shadow-card active:scale-95 transition cursor-pointer`}
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

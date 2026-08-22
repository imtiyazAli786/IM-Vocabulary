import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/review")({
  component: ReviewPage,
  head: () => ({ meta: [{ title: "Review — Lafz" }] }),
});

const SWIPE_THRESHOLD = 90; // px to commit a swipe

interface ExampleItem {
  en: string;
  ur?: string;
}

function maskWordInSentence(sentence: string, word: string): { masked: string; hasMatch: boolean } {
  if (!sentence || !word) return { masked: sentence, hasMatch: false };
  // Clean word for regex
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (regex.test(sentence)) {
    return {
      masked: sentence.replace(regex, "[ _______ ]"),
      hasMatch: true,
    };
  }
  // Try partial match if phrase or contains non-boundary
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
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [reviewMode, setReviewMode] = useState<"classic" | "cloze">("cloze");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // drag state
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
      const { data, error } = await supabase.from("words").select("tags").limit(200);
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

  const { data: dueWords, isLoading } = useQuery({
    queryKey: ["review-queue", selectedTag],
    queryFn: async () => {
      let query = supabase.from("words").select("*").lte("due_at", new Date().toISOString());

      if (selectedTag.trim()) {
        query = query.contains("tags", [selectedTag.trim().toLowerCase()]);
      }

      const { data, error } = await query.order("due_at", { ascending: true }).limit(30);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const current = dueWords?.[idx];

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
    if (committingRef.current) return;
    committingRef.current = true;

    setExiting(dir);
    try {
      await commitRating(rating);
    } catch {
      // rating save failed — still advance
    }
    window.setTimeout(() => {
      setReviewed((r) => r + 1);
      setFlipped(false);
      setDragY(0);
      setExiting(null);
      setIdx((i) => i + 1);
      committingRef.current = false;
    }, 220);
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
      setFlipped((f) => !f);
      setDragY(0);
      return;
    }
    if (dy <= -SWIPE_THRESHOLD) {
      advanceWith("good", "up");
    } else if (dy >= SWIPE_THRESHOLD) {
      advanceWith("again", "down");
    } else {
      setDragY(0);
    }
  };

  if (isLoading) return <LoadingScreen />;

  if (!dueWords || dueWords.length === 0 || idx >= dueWords.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-semibold">Review</h1>
        <Card className="p-10 text-center shadow-card">
          <Check className="w-12 h-12 text-success mx-auto mb-3" />
          <h2 className="text-xl font-display font-semibold">All done!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {reviewed > 0
              ? `You reviewed ${reviewed} word${reviewed > 1 ? "s" : ""}.`
              : "Nothing due right now."}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              Home
            </Button>
            <Button onClick={() => navigate({ to: "/quiz" })}>Take quiz</Button>
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
    <div className="space-y-3 overflow-hidden">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-display font-semibold">Review</h1>
          <div className="flex items-center rounded-lg bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setReviewMode("cloze")}
              className={cn(
                "px-2 py-1 rounded-md font-medium transition-colors",
                reviewMode === "cloze"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BookOpen className="w-3.5 h-3.5 inline mr-1" /> Sentence Cloze
            </button>
            <button
              type="button"
              onClick={() => setReviewMode("classic")}
              className={cn(
                "px-2 py-1 rounded-md font-medium transition-colors",
                reviewMode === "classic"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Layers className="w-3.5 h-3.5 inline mr-1" /> Flashcard
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {idx + 1} / {dueWords.length}
        </p>
      </header>

      {/* Optional Tag Filter Chips */}
      {allTags && allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <button
            type="button"
            onClick={() => {
              setSelectedTag("");
              setIdx(0);
            }}
            className={cn(
              "px-2 py-0.5 rounded-full font-medium transition-colors shrink-0",
              !selectedTag
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            All Decks
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSelectedTag(t === selectedTag ? "" : t);
                setIdx(0);
              }}
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

      <div
        className="relative touch-none select-none"
        style={{
          height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 14rem)",
          minHeight: 380,
        }}
      >
        {/* swipe hints */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 flex justify-center transition-opacity z-20 ${showUpHint ? "opacity-100" : "opacity-0"}`}
        >
          <div className="bg-success text-success-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 shadow-card">
            <ChevronUp className="w-3.5 h-3.5" /> I know it
          </div>
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 flex justify-center transition-opacity z-20 ${showDownHint ? "opacity-100" : "opacity-0"}`}
        >
          <div className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 shadow-card">
            <ChevronDown className="w-3.5 h-3.5" /> Study again
          </div>
        </div>

        <Card
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="h-full w-full p-5 sm:p-6 flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing shadow-elevated select-none touch-none overflow-y-auto"
          style={{
            transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
            opacity,
            transition: dragging ? "none" : "transform 220ms ease, opacity 220ms ease",
          }}
        >
          {!flipped ? (
            /* FRONT OF CARD */
            reviewMode === "cloze" && cloze ? (
              <div className="space-y-4 max-w-md">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                  Sentence in Context
                </span>
                <p className="text-xl sm:text-2xl font-serif leading-relaxed px-2">
                  "{cloze.masked}"
                </p>
                {primarySentence?.ur && (
                  <p className="font-urdu text-2xl text-muted-foreground pt-1" dir="rtl">
                    {primarySentence.ur}
                  </p>
                )}
                {current.part_of_speech && (
                  <p className="text-xs text-muted-foreground italic">({current.part_of_speech})</p>
                )}
                <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
                  <RotateCw className="w-3 h-3" /> Tap to reveal target word
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Sparkles className="w-6 h-6 text-accent mx-auto" />
                <p className="text-4xl font-display font-semibold">{current.word}</p>
                {current.part_of_speech && (
                  <p className="text-sm italic text-muted-foreground">({current.part_of_speech})</p>
                )}
                {currentTags.length > 0 && (
                  <div className="flex justify-center gap-1 pt-1">
                    {currentTags.map((t) => (
                      <span key={t} className="text-[10px] text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
                  <RotateCw className="w-3 h-3" /> Tap to reveal
                </p>
              </div>
            )
          ) : (
            /* BACK OF CARD */
            <div className="space-y-3 w-full max-w-md">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl sm:text-4xl font-display font-semibold text-primary">
                  {current.word}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(current.word);
                  }}
                >
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>

              {(current.one_word_en || current.one_word_ur) && (
                <div className="flex flex-wrap justify-center gap-2">
                  {current.one_word_en && (
                    <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-sm font-medium">
                      = {current.one_word_en}
                    </span>
                  )}
                  {current.one_word_ur && (
                    <span
                      className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-urdu text-lg"
                      dir="rtl"
                    >
                      = {current.one_word_ur}
                    </span>
                  )}
                </div>
              )}

              {current.translation_ur && (
                <p className="font-urdu text-3xl text-foreground font-medium" dir="rtl">
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
                <div className="flex flex-wrap justify-center gap-1.5 py-1 text-xs">
                  {currentCols.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground"
                    >
                      <BookMarked className="w-2.5 h-2.5" /> {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Sentence Audio & Phrasing */}
              {primarySentence?.en && (
                <div className="p-2.5 rounded-lg bg-muted/40 text-left border border-border/70 space-y-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                      In Sentence
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
                    <p className="font-urdu text-base text-right" dir="rtl">
                      {primarySentence.ur}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* SRS Rating Buttons */}
      {flipped && !exiting && (
        <div className="grid grid-cols-4 gap-2 pt-1">
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
      )}
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
      className={`${color} rounded-xl py-2.5 px-1.5 font-medium text-sm shadow-card active:scale-95 transition`}
    >
      <div>{label}</div>
      <div className="text-[10px] opacity-80 mt-0.5">{sub}</div>
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Volume2,
  Tag,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  RotateCcw,
  Layers,
  List,
  Search,
  Check,
  X,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { speak } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sentences")({
  component: SentencesPage,
  head: () => ({ meta: [{ title: "Sentence Cards — Lafz" }] }),
});

interface SentenceEntry {
  id: string;
  wordId: string;
  word: string;
  type: string;
  tags: string[];
  en: string;
  ur?: string;
}

const STORAGE_LAST_INDEX = "lafz_sentence_last_index";
const STORAGE_MASTERED = "lafz_sentence_mastered_ids";

function maskWord(sentence: string, word: string): string {
  if (!sentence || !word) return sentence;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (regex.test(sentence)) {
    return sentence.replace(regex, "[ _______ ]");
  }
  const looseRegex = new RegExp(escaped, "i");
  if (looseRegex.test(sentence)) {
    return sentence.replace(looseRegex, "[ _______ ]");
  }
  return sentence;
}

function SentencesPage() {
  const navigate = useNavigate();

  // View mode: 'cards' (immersive swipe player) or 'list' (browsing)
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [filterMode, setFilterMode] = useState<"all" | "remaining" | "mastered">("all");
  const [searchQ, setSearchQ] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [clozeMode, setClozeMode] = useState(false);
  const [showUrdu, setShowUrdu] = useState(true);

  // Mastery state
  const [masteredMap, setMasteredMap] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window === "undefined") return {};
      const raw = localStorage.getItem(STORAGE_MASTERED);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Current Card Index (for Card mode)
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [hasResumed, setHasResumed] = useState(false);

  // Fetch words and sentences
  const { data: words, isLoading } = useQuery({
    queryKey: ["words-sentences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("words")
        .select("id,word,type,tags,example_en,example_ur,examples")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Extract all sentences cleanly
  const allSentences = useMemo<SentenceEntry[]>(() => {
    if (!words) return [];
    const list: SentenceEntry[] = [];

    words.forEach((w) => {
      const tags = Array.isArray(w.tags) ? w.tags : [];
      let added = false;

      if (Array.isArray(w.examples) && w.examples.length > 0) {
        (w.examples as Array<{ en: string; ur?: string }>).forEach((ex, exIdx) => {
          if (ex.en && ex.en.trim()) {
            list.push({
              id: `${w.id}-ex-${exIdx}`,
              wordId: w.id,
              word: w.word,
              type: w.type || "word",
              tags,
              en: ex.en.trim(),
              ur: ex.ur?.trim() || "",
            });
            added = true;
          }
        });
      }

      if (!added && (w.example_en || w.example_ur)) {
        if (w.example_en && w.example_en.trim()) {
          list.push({
            id: `${w.id}-main`,
            wordId: w.id,
            word: w.word,
            type: w.type || "word",
            tags,
            en: w.example_en.trim(),
            ur: w.example_ur?.trim() || "",
          });
        }
      }
    });

    return list;
  }, [words]);

  // Unique tags
  const tagsList = useMemo(() => {
    const set = new Set<string>();
    allSentences.forEach((s) => s.tags.forEach((t) => t && set.add(t.toLowerCase())));
    return Array.from(set).sort();
  }, [allSentences]);

  // Filtered sentences based on tag, search, and mastery status
  const filtered = useMemo(() => {
    return allSentences.filter((s) => {
      if (filterMode === "mastered" && !masteredMap[s.id]) return false;
      if (filterMode === "remaining" && masteredMap[s.id]) return false;
      if (selectedTag && !s.tags.includes(selectedTag.toLowerCase())) return false;
      if (searchQ.trim()) {
        const q = searchQ.trim().toLowerCase();
        const matchesEn = s.en.toLowerCase().includes(q);
        const matchesUr = s.ur?.toLowerCase().includes(q);
        const matchesWord = s.word.toLowerCase().includes(q);
        return matchesEn || matchesUr || matchesWord;
      }
      return true;
    });
  }, [allSentences, filterMode, selectedTag, searchQ, masteredMap]);

  // Auto-resume from last saved position once data loads
  useEffect(() => {
    if (allSentences.length > 0 && !hasResumed) {
      try {
        const saved = localStorage.getItem(STORAGE_LAST_INDEX);
        if (saved) {
          const idx = parseInt(saved, 10);
          if (!isNaN(idx) && idx >= 0 && idx < allSentences.length) {
            setCurrentIndex(idx);
            if (idx > 0) {
              toast.info(`Resumed at sentence #${idx + 1} of ${allSentences.length}`, {
                duration: 2500,
              });
            }
          }
        }
      } catch {}
      setHasResumed(true);
    }
  }, [allSentences, hasResumed]);

  // Save current position whenever it changes
  const setCardIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(filtered.length - 1, index));
      setCurrentIndex(clamped);
      try {
        localStorage.setItem(STORAGE_LAST_INDEX, String(clamped));
      } catch {}
    },
    [filtered.length],
  );

  // Toggle mastery for a sentence
  const toggleMastery = useCallback((sentenceId: string) => {
    setMasteredMap((prev) => {
      const next = { ...prev, [sentenceId]: !prev[sentenceId] };
      try {
        localStorage.setItem(STORAGE_MASTERED, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Card navigation helpers
  const nextCard = useCallback(() => {
    if (currentIndex < filtered.length - 1) {
      setCardIndex(currentIndex + 1);
    }
  }, [currentIndex, filtered.length, setCardIndex]);

  const prevCard = useCallback(() => {
    if (currentIndex > 0) {
      setCardIndex(currentIndex - 1);
    }
  }, [currentIndex, setCardIndex]);

  // Keyboard navigation for card player
  useEffect(() => {
    if (viewMode !== "cards") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        nextCard();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        prevCard();
      } else if (e.key === " " || e.key === "u") {
        e.preventDefault();
        setShowUrdu((s) => !s);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, nextCard, prevCard]);

  // Touch Swipe Gesture handler
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;

    // Vertical swipe takes priority if stronger than horizontal
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 40) {
      if (deltaY < 0) {
        nextCard(); // Swiped Up -> Next Card
      } else {
        prevCard(); // Swiped Down -> Previous Card
      }
    } else if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        nextCard(); // Swiped Left -> Next
      } else {
        prevCard(); // Swiped Right -> Prev
      }
    }

    touchStartY.current = null;
    touchStartX.current = null;
  };

  if (isLoading) return <LoadingScreen />;

  const totalCount = allSentences.length;
  const masteredCount = allSentences.filter((s) => masteredMap[s.id]).length;
  const remainingCount = totalCount - masteredCount;
  const currentSentence = filtered[currentIndex];
  const isCurrentMastered = currentSentence ? !!masteredMap[currentSentence.id] : false;

  return (
    <div className="space-y-3 pb-4 max-w-xl mx-auto">
      {/* Top Header & Mastery Summary */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold">Sentences</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="font-medium text-foreground">{totalCount}</span> total ·{" "}
            <span className="text-success font-medium">{masteredCount} mastered</span> ·{" "}
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {remainingCount} to do
            </span>
          </p>
        </div>

        {/* View mode toggle (Cards vs List) */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
          <Button
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("cards")}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cards</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </Button>
        </div>
      </header>

      {/* Mastery Progress Bar */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${(masteredCount / Math.max(1, totalCount)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter Tabs & Options */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setFilterMode("all");
              setCurrentIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-colors shrink-0",
              filterMode === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode("remaining");
              setCurrentIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-colors shrink-0",
              filterMode === "remaining"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            To Practice ({remainingCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode("mastered");
              setCurrentIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-colors shrink-0",
              filterMode === "mastered"
                ? "bg-success text-success-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Mastered ({masteredCount})
          </button>
        </div>

        {/* Cloze Mask Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setClozeMode((c) => !c)}
          className={cn(
            "h-7 px-2 text-xs transition-colors shrink-0",
            clozeMode && "bg-primary text-primary-foreground border-primary",
          )}
          title="Hide the target word to test your recall"
        >
          {clozeMode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
          {clozeMode ? "Masked" : "Test"}
        </Button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODE A: INTERACTIVE SWIPE CARDS (DEFAULT)
         ───────────────────────────────────────────────────────────── */}
      {viewMode === "cards" ? (
        filtered.length === 0 ? (
          <Card className="p-10 text-center border-dashed shadow-none">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="font-semibold text-lg">
              {filterMode === "remaining" ? "All sentences mastered! 🎉" : "No sentences found"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterMode === "remaining"
                ? "Awesome job! You've marked every sentence as mastered."
                : "Try selecting a different filter."}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterMode("all");
                setCurrentIndex(0);
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Review all sentences
            </Button>
          </Card>
        ) : (
          <div
            className="space-y-3 select-none touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Card Index & Progress Pill */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Card {currentIndex + 1} of {filtered.length}
              </span>
              <span className="text-xs text-muted-foreground">Swipe up / down or use buttons</span>
            </div>

            {/* Main Interactive Swipe Card */}
            <Card className="p-6 sm:p-8 shadow-elevated border-border bg-card rounded-2xl min-h-[340px] flex flex-col justify-between relative transition-all">
              {/* Card Header: Headword, Type, Tags, TTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        navigate({ to: "/words/$id", params: { id: currentSentence.wordId } })
                      }
                      className="inline-flex items-center gap-1.5 text-base font-bold text-primary hover:underline group"
                    >
                      <span>{currentSentence.word}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    {currentSentence.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9 rounded-full bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                    onClick={() => speak(currentSentence.en)}
                    title="Listen to native pronunciation"
                  >
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>

                {/* English Sentence */}
                <div className="pt-2">
                  <p className="text-xl sm:text-2xl font-serif leading-relaxed text-foreground">
                    "{clozeMode ? maskWord(currentSentence.en, currentSentence.word) : currentSentence.en}"
                  </p>
                </div>
              </div>

              {/* Urdu Translation Card Section (Toggle / Reveal) */}
              <div className="pt-6 border-t border-border/60 mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Urdu Meaning
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowUrdu((s) => !s)}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    {showUrdu ? "Hide" : "Reveal translation"}
                  </button>
                </div>

                {showUrdu ? (
                  <p
                    className="font-urdu text-2xl sm:text-3xl text-foreground/90 text-right leading-loose pt-1"
                    dir="rtl"
                  >
                    {currentSentence.ur || "ترجمہ موجود نہیں"}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowUrdu(true)}
                    className="w-full py-4 text-center text-sm font-medium text-muted-foreground bg-muted/30 rounded-xl border border-dashed hover:bg-muted/50 transition-colors"
                  >
                    Tap to reveal Urdu translation
                  </button>
                )}
              </div>

              {/* Mastered Badge Indicator */}
              {isCurrentMastered && (
                <div className="absolute top-4 right-14 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-success/15 text-success text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" /> Mastered
                </div>
              )}
            </Card>

            {/* Bottom Card Actions & Navigation Controls */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Previous Button */}
              <Button
                variant="outline"
                size="lg"
                onClick={prevCard}
                disabled={currentIndex === 0}
                className="h-12 text-sm font-medium gap-1"
              >
                <ChevronUp className="w-4 h-4" /> Previous
              </Button>

              {/* Mark Mastered / Need Practice Toggle */}
              <Button
                variant={isCurrentMastered ? "secondary" : "default"}
                size="lg"
                onClick={() => toggleMastery(currentSentence.id)}
                className={cn(
                  "h-12 text-sm font-medium gap-1.5 transition-colors",
                  isCurrentMastered
                    ? "bg-success/15 text-success hover:bg-success/25 border-success/30"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {isCurrentMastered ? (
                  <>
                    <RotateCcw className="w-4 h-4" /> Practicing
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Got it! ✓
                  </>
                )}
              </Button>

              {/* Next Button */}
              <Button
                variant="outline"
                size="lg"
                onClick={nextCard}
                disabled={currentIndex >= filtered.length - 1}
                className="h-12 text-sm font-medium gap-1"
              >
                Next <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )
      ) : (
        /* ─────────────────────────────────────────────────────────────
            MODE B: SCROLLABLE LIST VIEW (FOR SEARCHING & SCANNING)
           ───────────────────────────────────────────────────────────── */
        <div className="space-y-3">
          {/* Search Bar in list mode */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sentences in English or Urdu…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* List Items */}
          {filtered.length === 0 ? (
            <Card className="p-10 text-center border-dashed shadow-none">
              <p className="font-medium">No matching sentences found</p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((s, idx) => {
                const isMastered = !!masteredMap[s.id];
                return (
                  <Card
                    key={s.id}
                    className="p-4 shadow-card hover:shadow-elevated transition-shadow space-y-2 relative"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => navigate({ to: "/words/$id", params: { id: s.wordId } })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <span>{s.word}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                        </button>
                        {s.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMastery(s.id)}
                          className={cn(
                            "h-7 px-2 text-xs",
                            isMastered ? "text-success font-semibold" : "text-muted-foreground",
                          )}
                        >
                          {isMastered ? "✓ Mastered" : "Mark Mastered"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-full"
                          onClick={() => speak(s.en)}
                        >
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-base font-serif leading-relaxed text-foreground">
                      "{clozeMode ? maskWord(s.en, s.word) : s.en}"
                    </p>

                    {s.ur && (
                      <p
                        className="font-urdu text-xl text-muted-foreground text-right pt-0.5"
                        dir="rtl"
                      >
                        {s.ur}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

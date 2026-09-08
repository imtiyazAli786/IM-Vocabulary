import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Search,
  Sparkles,
  Upload,
  ChevronLeft,
  ChevronRight,
  Volume2,
  X,
} from "lucide-react";
import { TYPE_COLORS, formatType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/speech";
import {
  FormalityRegister,
  REGISTER_CONFIG,
  extractFormalitySpectrum,
} from "@/lib/formality";

const searchSchema = z.object({
  page: z.number().int().min(1).catch(1),
  q: z.string().optional().catch(""),
  register: z.string().optional().catch(""),
});

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_app/words/")({
  component: WordsPage,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "My Words — Lafz" }] }),
});

function WordsPage() {
  const navigate = useNavigate();
  const { page, q, register } = Route.useSearch();

  // Local state for debounced search
  const [searchInput, setSearchInput] = useState(q || "");

  useEffect(() => {
    setSearchInput(q || "");
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (q || "")) {
        navigate({
          to: "/words",
          search: {
            page: 1,
            q: searchInput.trim() || undefined,
            register: register || undefined,
          },
          replace: true,
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, register, q, navigate]);

  const { data: allRawWords, isLoading } = useQuery({
    queryKey: ["words-all-raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("words")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  // Calculate situation category counts
  const categoryCounts = useMemo(() => {
    if (!allRawWords) return { all: 0, "daily-life": 0, workplace: 0, "news-reading": 0 };
    const counts = { all: allRawWords.length, "daily-life": 0, workplace: 0, "news-reading": 0 };
    allRawWords.forEach((w) => {
      const cat = extractFormalitySpectrum(w).category;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [allRawWords]);

  // Filter by search query & category
  const filteredWords = useMemo(() => {
    if (!allRawWords) return [];
    let list = allRawWords;

    if (register) {
      const normalized =
        register === "informal" ? "daily-life" : register === "neutral" ? "workplace" : register === "formal" ? "news-reading" : register;
      if (["daily-life", "workplace", "news-reading"].includes(normalized)) {
        list = list.filter((w) => extractFormalitySpectrum(w).category === normalized);
      }
    }

    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.word.toLowerCase().includes(needle) ||
          (w.definition_en && w.definition_en.toLowerCase().includes(needle)) ||
          (w.translation_ur && w.translation_ur.includes(needle)) ||
          (w.one_word_en && w.one_word_en.toLowerCase().includes(needle))
      );
    }

    return list;
  }, [allRawWords, q, register]);

  const total = filteredWords.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredWords.slice(from, from + PAGE_SIZE);

  const setPage = (p: number, searchQ?: string, selectedRegister?: string) =>
    navigate({
      to: "/words",
      search: {
        page: Math.max(1, Math.min(totalPages, p)),
        q: searchQ !== undefined ? searchQ : q,
        register: selectedRegister !== undefined ? selectedRegister : register,
      },
    });

  const handleRegisterToggle = (selectedReg: string) => {
    const next = register === selectedReg ? undefined : selectedReg;
    navigate({
      to: "/words",
      search: {
        page: 1,
        q: q || undefined,
        register: next,
      },
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    navigate({
      to: "/words",
      search: {
        page: 1,
        q: undefined,
        register: undefined,
      },
    });
  };

  if (isLoading && (!allRawWords || allRawWords.length === 0)) {
    return (
      <div className="space-y-3 pb-8">
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-display font-semibold truncate">My Words</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" disabled>
              <Upload className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Import</span>
            </Button>
            <Button size="sm" disabled>
              <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </header>

        <div className="space-y-2.5 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border/70 bg-card/60 animate-pulse space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-5 bg-muted rounded w-28" />
                <div className="h-5 bg-muted rounded w-16" />
              </div>
              <div className="h-3.5 bg-muted/60 rounded w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-8">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-display font-semibold truncate">My Words</h1>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/import" })}>
            <Upload className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" onClick={() => navigate({ to: "/words/add" })}>
            <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search words, definitions, translations…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1.5 rounded-full hover:bg-muted/80 flex items-center justify-center transition-colors"
            title="Clear search"
            aria-label="Clear search query"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3 Permanent Situation Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          type="button"
          onClick={() => handleRegisterToggle("")}
          aria-pressed={!register}
          className={cn(
            "px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            !register
              ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/20 font-semibold"
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          All ({categoryCounts.all})
        </button>

        <button
          type="button"
          onClick={() => handleRegisterToggle("daily-life")}
          aria-pressed={register === "daily-life" || register === "informal"}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            register === "daily-life" || register === "informal"
              ? CATEGORY_CONFIG["daily-life"].colorActivePill
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>🏠 Daily Life</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts["daily-life"]})</span>
        </button>

        <button
          type="button"
          onClick={() => handleRegisterToggle("workplace")}
          aria-pressed={register === "workplace" || register === "neutral"}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            register === "workplace" || register === "neutral"
              ? CATEGORY_CONFIG.workplace.colorActivePill
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>💼 Workplace</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts.workplace})</span>
        </button>

        <button
          type="button"
          onClick={() => handleRegisterToggle("news-reading")}
          aria-pressed={register === "news-reading" || register === "formal"}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border cursor-pointer",
            register === "news-reading" || register === "formal"
              ? CATEGORY_CONFIG["news-reading"].colorActivePill
              : "bg-card hover:bg-muted/60 text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>📰 News Reading</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts["news-reading"]})</span>
        </button>
      </div>

      {pageItems.length === 0 ? (
        <Card className="p-10 text-center border-dashed shadow-none">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground">
            {q || register ? "No words match your filter." : "No words yet."}
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {q || register
              ? "Try resetting filters or searching for another word."
              : "Add your first word or import a vocabulary list."}
          </p>
          {q || register ? (
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={() => navigate({ to: "/words/add" })}>
                Add word
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/import" })}>
                Import
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Words Count and Top Pagination Controls */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total} words
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 min-w-[32px] min-h-[32px]"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium px-1">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 min-w-[32px] min-h-[32px]"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  title="Next page"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Natural Card List without fixed height or virtual scroll trap */}
          <div className="space-y-2">
            {pageItems.map((w) => {
              const spectrum = extractFormalitySpectrum(w);

              return (
                <Card
                  key={w.id}
                  role="button"
                  tabIndex={0}
                  className="p-3.5 sm:p-4 hover:shadow-elevated transition-all duration-200 shadow-card cursor-pointer border-border/80 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40 bg-card rounded-xl group"
                  onClick={() => navigate({ to: "/words/$id", params: { id: w.id } })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate({ to: "/words/$id", params: { id: w.id } });
                    }
                  }}
                >
                  {/* Single-Row / 2-Column: English Word + Register on Left; Urdu Meaning on Right */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Left Column: Word, Audio, Register Badge & Meaning */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-display font-bold text-base sm:text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">
                          {w.word}
                        </h3>

                        {/* Quick Audio Playback Button */}
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 inline-flex items-center justify-center transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(w.word);
                          }}
                          aria-label={`Listen to pronunciation of ${w.word}`}
                          title="Listen to pronunciation"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Minimal Formality Register Badge */}
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                            REGISTER_CONFIG[spectrum.register]?.colorBadge || "bg-muted text-muted-foreground"
                          )}
                        >
                          {REGISTER_CONFIG[spectrum.register]?.shortLabel}
                        </span>

                        {w.part_of_speech && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {w.part_of_speech}
                          </span>
                        )}
                        {w.type && w.type !== "word" && (
                          <span
                            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${TYPE_COLORS[w.type] || "bg-muted text-muted-foreground"}`}
                          >
                            {formatType(w.type)}
                          </span>
                        )}
                      </div>

                      {/* English Meaning (First line only) */}
                      {w.one_word_en ? (
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                          <span className="text-foreground/85 font-semibold">{w.one_word_en}</span>
                          {w.definition_en && w.definition_en.toLowerCase() !== w.one_word_en.toLowerCase() && (
                            <span className="text-xs text-muted-foreground/80 ml-1.5 font-normal">
                              — {w.definition_en.slice(0, 45)}{w.definition_en.length > 45 ? "…" : ""}
                            </span>
                          )}
                        </p>
                      ) : w.definition_en ? (
                        <p className="text-xs text-muted-foreground truncate leading-relaxed">
                          {w.definition_en}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/40 italic">
                          Tap to view & add details
                        </p>
                      )}
                    </div>

                    {/* Right Column: Urdu Meaning */}
                    <div className="text-right shrink-0 max-w-[45%]">
                      {w.one_word_ur ? (
                        <p className="font-urdu text-lg sm:text-xl text-primary font-medium leading-normal" dir="rtl">
                          {w.one_word_ur}
                        </p>
                      ) : w.translation_ur ? (
                        <p className="font-urdu text-base sm:text-lg text-primary/90 font-medium leading-normal truncate" dir="rtl">
                          {w.translation_ur}
                        </p>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40 font-medium group-hover:text-primary transition-colors">
                          Add Urdu →
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Bottom Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setPage(currentPage - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setPage(currentPage + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

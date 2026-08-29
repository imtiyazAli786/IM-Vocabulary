import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
} from "lucide-react";
import { TYPE_COLORS, formatType } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
    staleTime: 0,
    refetchOnMount: "always",
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

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: pageItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 6,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const handleSearchChange = (val: string) => {
    setPage(1, val, register);
  };

  const handleRegisterToggle = (selectedReg: string) => {
    const next = register === selectedReg ? "" : selectedReg;
    setPage(1, q, next);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-semibold">My Words</h1>
        <Card className="p-10 text-center border-dashed shadow-none">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
          value={q}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 3 Permanent Situation Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          type="button"
          onClick={() => handleRegisterToggle("")}
          className={cn(
            "px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            !register
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          All ({categoryCounts.all})
        </button>

        <button
          type="button"
          onClick={() => handleRegisterToggle("daily-life")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            register === "daily-life" || register === "informal"
              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>🏠 Daily Life</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts["daily-life"]})</span>
        </button>

        <button
          type="button"
          onClick={() => handleRegisterToggle("workplace")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            register === "workplace" || register === "neutral"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <span>💼 Workplace</span>
          <span className="text-[10px] opacity-75 font-mono">({categoryCounts.workplace})</span>
        </button>

        <button
          type="button"
          onClick={() => handleRegisterToggle("news-reading")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all shrink-0 border",
            register === "news-reading" || register === "formal"
              ? "bg-sky-600 text-white border-sky-600 shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
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
            <Button size="sm" variant="outline" onClick={() => setPage(1, "", "")}>
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
          {/* Words Count and Pagination Header */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total} words
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Virtualized Word Cards List */}
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{
              height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 15.5rem)",
              minHeight: 380,
            }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const w = pageItems[vi.index];
                if (!w) return null;
                const spectrum = extractFormalitySpectrum(w);

                return (
                  <div
                    key={w.id}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`,
                      paddingBottom: 8,
                    }}
                  >
                    <Card
                      className="p-3.5 sm:p-4 hover:shadow-elevated transition-all duration-200 shadow-card cursor-pointer border-border/80 hover:border-primary/40 bg-card rounded-xl group"
                      onClick={() => navigate({ to: "/words/$id", params: { id: w.id } })}
                    >
                      {/* Clean Single-Row / 2-Column: English Word + Register on Left; Urdu Meaning on Right */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Left Column: Word, Register Badge & Meaning */}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-display font-bold text-base sm:text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">
                              {w.word}
                            </h3>

                            {/* Minimal Formality Register Badge */}
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.2 rounded-full border",
                                REGISTER_CONFIG[spectrum.register]?.colorBadge || "bg-muted text-muted-foreground"
                              )}
                            >
                              {REGISTER_CONFIG[spectrum.register]?.shortLabel}
                            </span>

                            {w.part_of_speech && (
                              <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-muted text-muted-foreground">
                                {w.part_of_speech}
                              </span>
                            )}
                            {w.type && w.type !== "word" && (
                              <span
                                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded font-semibold ${TYPE_COLORS[w.type] || "bg-muted text-muted-foreground"}`}
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
                          ) : null}
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
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

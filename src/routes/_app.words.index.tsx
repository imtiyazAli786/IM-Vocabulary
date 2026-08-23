import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
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
  Tag,
  BookMarked,
} from "lucide-react";
import { TYPE_COLORS, formatType } from "@/lib/constants";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  page: z.number().int().min(1).catch(1),
  q: z.string().optional().catch(""),
  tag: z.string().optional().catch(""),
});

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_app/words/")({
  component: WordsPage,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "My Words — Lafz" }] }),
});

function WordsPage() {
  const navigate = useNavigate();
  const { page, q, tag } = Route.useSearch();

  // Fetch available tags
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

  const { data, isLoading } = useQuery({
    queryKey: ["words", q, tag, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from("words").select("*", { count: "exact" });

      if (tag?.trim()) {
        query = query.contains("tags", [tag.trim().toLowerCase()]);
      }

      if (q?.trim()) {
        const needle = q.trim().toLowerCase();
        query = query.or(
          `word.ilike.%${needle}%,definition_en.ilike.%${needle}%,translation_ur.ilike.%${needle}%`,
        );
      }

      const {
        data: rows,
        count,
        error,
      } = await query.order("created_at", { ascending: false }).range(from, to);
      if (error) {
        console.error("Fetch words error:", error);
        throw error;
      }
      return { rows: rows ?? [], total: count ?? 0 };
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = data?.rows ?? [];

  const setPage = (p: number, searchQ?: string, selectedTag?: string) =>
    navigate({
      to: "/words",
      search: {
        page: Math.max(1, Math.min(totalPages, p)),
        q: searchQ !== undefined ? searchQ : q,
        tag: selectedTag !== undefined ? selectedTag : tag,
      },
    });

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: pageItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 6,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const handleSearchChange = (val: string) => {
    setPage(1, val, tag);
  };

  const handleTagToggle = (selectedTag: string) => {
    const nextTag = tag === selectedTag ? "" : selectedTag;
    setPage(1, q, nextTag);
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

  const total = data?.total ?? 0;

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

      {/* Tag filter pills */}
      {allTags && allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => handleTagToggle("")}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-colors shrink-0",
              !tag
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {allTags.map((t) => {
            const active = tag === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleTagToggle(t)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:text-foreground",
                )}
              >
                <Tag className="w-3 h-3" /> #{t}
              </button>
            );
          })}
        </div>
      )}

      {pageItems.length === 0 ? (
        <Card className="p-10 text-center border-dashed shadow-none">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">{total > 0 ? "No matches" : "Your library is empty"}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0
              ? "Try a different search or tag filter."
              : "Add your first word or import from a file."}
          </p>
          {!total && (
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => navigate({ to: "/import" })}>
                <Upload className="w-4 h-4 mr-1" /> Import
              </Button>
              <Button size="sm" onClick={() => navigate({ to: "/words/add" })}>
                <Plus className="w-4 h-4 mr-1" /> Add word
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: "calc(100vh - 310px)", minHeight: 380 }}
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
                const itemTags = Array.isArray(w.tags) ? w.tags : [];
                const itemCols = Array.isArray(w.collocations) ? w.collocations : [];

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
                      className="p-4 hover:shadow-elevated transition-all duration-200 shadow-card cursor-pointer border-border/80 hover:border-primary/40 bg-card rounded-2xl group space-y-2.5"
                      onClick={() => navigate({ to: "/words/$id", params: { id: w.id } })}
                    >
                      {/* Row 1: English Word + Type/POS on Left; Urdu Meaning on Right */}
                      <div className="flex items-start justify-between gap-3">
                        {/* Left Column: Word & English Meaning */}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display font-bold text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">
                              {w.word}
                            </h3>
                            {w.part_of_speech && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
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

                          {/* One-Word English Meaning / Definition */}
                          {w.one_word_en ? (
                            <p className="text-sm font-medium text-muted-foreground truncate">
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

                        {/* Right Column: Urdu Meaning in Clean Nastaliq Typography */}
                        <div className="text-right shrink-0 max-w-[45%]">
                          {w.one_word_ur ? (
                            <p className="font-urdu text-2xl font-bold text-primary leading-tight" dir="rtl">
                              {w.one_word_ur}
                            </p>
                          ) : w.translation_ur ? (
                            <p className="font-urdu text-xl font-medium text-primary/90 leading-tight truncate" dir="rtl">
                              {w.translation_ur}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Row 2: Clean Synonyms & Antonyms Badges */}
                      {(w.synonym || w.antonym) && (
                        <div className="flex items-center gap-2 flex-wrap pt-0.5 text-xs">
                          {w.synonym && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
                              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Syn</span>
                              <span>{w.synonym}</span>
                            </span>
                          )}
                          {w.antonym && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium">
                              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Ant</span>
                              <span>{w.antonym}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Row 3: Tags & Collocations Footer */}
                      {(itemTags.length > 0 || itemCols.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-[11px]">
                          {itemTags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-[11px]"
                            >
                              <Tag className="w-2.5 h-2.5" /> #{t}
                            </span>
                          ))}
                          {itemCols.slice(0, 2).map((col) => (
                            <span
                              key={col}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[11px]"
                            >
                              <BookMarked className="w-2.5 h-2.5 opacity-70" /> {col}
                            </span>
                          ))}
                        </div>
                      )}
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Search,
  Volume2,
  Tag,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  MessageSquareQuote,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { speak } from "@/lib/speech";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/sentences")({
  component: SentencesPage,
  head: () => ({ meta: [{ title: "Sentences — Lafz" }] }),
});

interface SentenceEntry {
  wordId: string;
  word: string;
  type: string;
  tags: string[];
  en: string;
  ur?: string;
}

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
  const [searchQ, setSearchQ] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [clozeMode, setClozeMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

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
    staleTime: 60_000,
  });

  // Extract all sentences
  const allSentences = useMemo<SentenceEntry[]>(() => {
    if (!words) return [];
    const list: SentenceEntry[] = [];

    words.forEach((w) => {
      const tags = Array.isArray(w.tags) ? w.tags : [];
      let foundSentences = false;

      if (Array.isArray(w.examples) && w.examples.length > 0) {
        (w.examples as Array<{ en: string; ur?: string }>).forEach((ex) => {
          if (ex.en && ex.en.trim()) {
            list.push({
              wordId: w.id,
              word: w.word,
              type: w.type,
              tags,
              en: ex.en.trim(),
              ur: ex.ur?.trim() || "",
            });
            foundSentences = true;
          }
        });
      }

      if (!foundSentences && (w.example_en || w.example_ur)) {
        if (w.example_en && w.example_en.trim()) {
          list.push({
            wordId: w.id,
            word: w.word,
            type: w.type,
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

  // Filtered sentences
  const filtered = useMemo(() => {
    return allSentences.filter((s) => {
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
  }, [allSentences, selectedTag, searchQ]);

  const toggleReveal = (key: string) => {
    setRevealedIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-3 pb-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold">Sentences</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} sentence{filtered.length !== 1 ? "s" : ""} in library
          </p>
        </div>

        {/* Cloze Mode Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setClozeMode((c) => !c)}
          className={cn(
            "text-xs transition-colors shrink-0",
            clozeMode && "bg-primary text-primary-foreground border-primary",
          )}
        >
          {clozeMode ? (
            <>
              <EyeOff className="w-3.5 h-3.5 mr-1" /> Masked
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 mr-1" /> Practice
            </>
          )}
        </Button>
      </header>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search sentences in English or Urdu…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tag Filter Chips */}
      {tagsList.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedTag("")}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-colors shrink-0",
              !selectedTag
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            All Sentences
          </button>
          {tagsList.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTag(t === selectedTag ? "" : t)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 border",
                selectedTag === t
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}
            >
              <Tag className="w-3 h-3" /> #{t}
            </button>
          ))}
        </div>
      )}

      {/* Sentences List */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed shadow-none">
          <MessageSquareQuote className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">
            {allSentences.length > 0 ? "No sentences found" : "No sentences added yet"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {allSentences.length > 0
              ? "Try another search or tag filter."
              : "Add words with example sentences to populate your sentence bank."}
          </p>
          {allSentences.length === 0 && (
            <Button className="mt-4" size="sm" onClick={() => navigate({ to: "/words/add" })}>
              Add entry
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((s, idx) => {
            const itemKey = `${s.wordId}-${idx}`;
            const isRevealed = revealedIds[itemKey];
            const displaySentence = clozeMode && !isRevealed ? maskWord(s.en, s.word) : s.en;

            return (
              <Card
                key={itemKey}
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
                      <ArrowRight className="w-3 h-3 opacity-60" />
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
                    {clozeMode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleReveal(itemKey)}
                        className="h-7 px-2 text-xs text-muted-foreground"
                      >
                        {isRevealed ? "Hide" : "Reveal"}
                      </Button>
                    )}
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

                {/* English sentence */}
                <p className="text-base font-serif leading-relaxed text-foreground">
                  "{displaySentence}"
                </p>

                {/* Urdu translation */}
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
  );
}

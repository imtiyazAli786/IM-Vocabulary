import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { classifyAndEnrichFormalityBatch } from "@/lib/ai.functions";
import { normalizeCategory, CATEGORY_CONFIG, PermanentCategory } from "@/lib/formality";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function UpgradeFormalityModal({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const qc = useQueryClient();
  const classifyBatch = useServerFn(classifyAndEnrichFormalityBatch);
  const [open, setOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDone, setIsDone] = useState(false);

  const startUpgrade = async () => {
    setUpgrading(true);
    setIsDone(false);
    try {
      // 1. Fetch all words
      const { data: words, error } = await supabase
        .from("words")
        .select("id,word,tags,notes")
        .order("created_at", { ascending: false });

      if (error || !words || words.length === 0) {
        toast.error("No words found to categorize.");
        setUpgrading(false);
        return;
      }

      const total = words.length;
      setProgress({ current: 0, total });

      // 2. Process in batches of 12 words to avoid AI payload limits
      const BATCH_SIZE = 12;
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = words.slice(i, i + BATCH_SIZE);
        const payload = chunk.map((w) => ({ id: w.id, word: w.word }));

        try {
          const { results } = await classifyBatch({ data: { words: payload } });

          // Update each word in Supabase
          if (results && results.length > 0) {
            await Promise.all(
              results.map(async (r) => {
                const target = chunk.find((w) => w.id === r.id);
                if (!target) return;

                const cat: PermanentCategory = normalizeCategory(r.category || r.register);
                const updatedTags = [cat];

                const spectrumMetadata = JSON.stringify({
                  category: cat,
                  formal: r.formal,
                  neutral: r.neutral,
                  informal: r.informal,
                });

                // Prepend or update notes with spectrum metadata
                let updatedNotes = target.notes || "";
                if (updatedNotes.includes('"category"') || updatedNotes.includes('"register"')) {
                  updatedNotes = updatedNotes.replace(/\{[\s\S]*"(category|register)"[\s\S]*\}/, spectrumMetadata);
                } else {
                  updatedNotes = spectrumMetadata + (updatedNotes ? "\n" + updatedNotes : "");
                }

                await supabase
                  .from("words")
                  .update({
                    tags: updatedTags,
                    notes: updatedNotes,
                  })
                  .eq("id", r.id);
              })
            );
          }
        } catch (batchErr) {
          console.warn("Batch upgrade error:", batchErr);
        }

        setProgress({ current: Math.min(total, i + BATCH_SIZE), total });
      }

      setIsDone(true);
      toast.success(`Successfully categorized all ${total} words!`);
      qc.invalidateQueries({ queryKey: ["review-words"] });
      qc.invalidateQueries({ queryKey: ["words"] });
      qc.invalidateQueries({ queryKey: ["words-all-raw"] });
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to categorize words");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>✨ Categorize Library</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Sparkles className="w-5 h-5 text-primary" /> Auto-Categorize Library
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            Gemini AI will clean up tags and classify all your vocabulary into 3 situation pillars:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-2 text-xs">
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200">
            <span className="font-bold">🏠 #daily-life:</span> Home, family, friends, reality shows & casual chat
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
            <span className="font-bold">💼 #workplace:</span> Office environment, team meetings, emails & coworkers
          </div>
          <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-900 dark:text-sky-200">
            <span className="font-bold">📰 #news-reading:</span> Newspaper articles, formal writing & editorials
          </div>
        </div>

        {upgrading && (
          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Categorizing with AI...
              </span>
              <span>
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${(progress.current / Math.max(1, progress.total)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {isDone && (
          <div className="p-3 rounded-lg bg-success/15 border border-success/30 flex items-center gap-2 text-success text-xs font-semibold">
            <Check className="w-4 h-4" /> All words organized into 3 permanent situation tags!
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={upgrading}
          >
            Close
          </Button>
          {!isDone ? (
            <Button
              type="button"
              onClick={startUpgrade}
              disabled={upgrading}
              className="gap-1.5"
            >
              {upgrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Categorizing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Start 1-Click Categorization
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

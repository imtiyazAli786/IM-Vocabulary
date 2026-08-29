import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseVocabularyDocument, getLocalCSVEntries } from "@/lib/import.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, FileText, Check, Loader2, Save, X, Database } from "lucide-react";
import { toast } from "sonner";
import mammoth from "mammoth";
import { TYPE_COLORS, formatType } from "@/lib/constants";

export const Route = createFileRoute("/_app/import")({
  component: ImportPage,
  head: () => ({ meta: [{ title: "Import document — Lafz" }] }),
});

interface ParsedEntry {
  word: string;
  type?: "word" | "phrase" | "connector" | "idiom" | "tense_pattern";
  part_of_speech?: string;
  one_word_en?: string;
  one_word_ur?: string;
  synonym?: string;
  antonym?: string;
  definition_en?: string;
  translation_ur?: string;
  example_en?: string;
  example_ur?: string;
  notes?: string;
  selected: boolean;
}

// TYPE_COLORS imported from @/lib/constants

function ImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const parseDoc = useServerFn(parseVocabularyDocument);
  const loadLocalCSV = useServerFn(getLocalCSVEntries);

  const [step, setStep] = useState<"upload" | "parsing" | "review" | "saving">("upload");
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [reviewLimit, setReviewLimit] = useState(100);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setStep("parsing");

      try {
        let text = "";

        if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else if (
          file.name.endsWith(".txt") ||
          file.name.endsWith(".csv") ||
          file.name.endsWith(".md")
        ) {
          text = await file.text();
        } else {
          text = await file.text();
        }

        if (!text.trim()) {
          toast.error("Could not extract text from this file.");
          setStep("upload");
          return;
        }

        const result = await parseDoc({ data: { text } });
        const parsed: ParsedEntry[] = result.entries
          .filter((e): e is typeof e & { word: string } => !!e.word?.trim())
          .map((e) => ({
            word: e.word!.trim(),
            // CQ-7: map type field from AI-parsed result
            type: e.type as ParsedEntry["type"] | undefined,
            part_of_speech: e.part_of_speech,
            one_word_en: e.one_word_en,
            one_word_ur: e.one_word_ur,
            synonym: e.synonym,
            antonym: e.antonym,
            definition_en: e.definition_en,
            translation_ur: e.translation_ur,
            example_en: e.example_en,
            example_ur: e.example_ur,
            notes: e.notes,
            selected: true,
          }));

        if (parsed.length === 0) {
          toast.error("No vocabulary entries found in the document.");
          setStep("upload");
          return;
        }

        setEntries(parsed);
        setStep("review");
        toast.success(`Found ${parsed.length} entries`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to parse document");
        setStep("upload");
      }
    },
    [parseDoc],
  );

  const handleLocalCSVScan = useCallback(async () => {
    setFileName("Local CSV Backups");
    setStep("parsing");

    try {
      const result = await loadLocalCSV();
      const parsed: ParsedEntry[] = result.entries.map((e) => ({
        word: e.word.trim(),
        type: e.type,
        definition_en: e.definition_en || undefined,
        translation_ur: e.translation_ur || undefined,
        notes: e.notes || undefined,
        selected: true,
      }));

      if (parsed.length === 0) {
        toast.error("No local backup entries found or directory is empty.");
        setStep("upload");
        return;
      }

      setEntries(parsed);
      setReviewLimit(100);
      setStep("review");
      toast.success(`Loaded ${parsed.length} entries from local backups`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load local backup");
      setStep("upload");
    }
  }, [loadLocalCSV]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const toggleSelect = (i: number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], selected: !next[i].selected };
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected: checked })));
  };

  const selectedCount = entries.filter((e) => e.selected).length;

  const handleSave = async () => {
    const toSave = entries.filter((e) => e.selected && e.word.trim());
    if (toSave.length === 0) {
      toast.error("No entries selected");
      return;
    }

    setStep("saving");
    setTotalCount(toSave.length);
    setSavedCount(0);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");

      // Bug 8: client-side deduplication — fetch existing word strings and skip matches
      const { data: existingData } = await supabase
        .from("words")
        .select("word")
        .eq("user_id", userRes.user.id);
      const existingSet = new Set((existingData ?? []).map((w) => w.word.trim().toLowerCase()));

      const deduplicated = toSave.filter((e) => !existingSet.has(e.word.trim().toLowerCase()));
      const skippedCount = toSave.length - deduplicated.length;

      if (deduplicated.length === 0) {
        toast.info("All selected entries already exist in your library.");
        setStep("review");
        return;
      }

      const VALID_TYPES = new Set(["word", "phrase", "connector", "idiom", "tense_pattern"]);
      const sanitizeType = (t?: string, word?: string): "word" | "phrase" | "connector" | "idiom" | "tense_pattern" => {
        if (t && VALID_TYPES.has(t.toLowerCase())) return t.toLowerCase() as any;
        if (word && word.trim().split(/\s+/).length > 1) return "phrase";
        return "word";
      };

      const rows = deduplicated.map((e) => {
        const reg = (e.register || "").toLowerCase().trim();
        const registerTag = ["formal", "neutral", "informal"].includes(reg) ? [reg] : [];

        const spectrumMeta = reg
          ? JSON.stringify({
              register: reg,
              formal: e.formal_equivalent || (reg === "formal" ? e.word.trim() : ""),
              neutral: e.neutral_equivalent || (reg === "neutral" ? e.word.trim() : ""),
              informal: e.spoken_equivalent || (reg === "informal" ? e.word.trim() : ""),
            })
          : "";

        return {
          user_id: userRes.user.id,
          word: e.word.trim(),
          type: sanitizeType(e.type, e.word),
          part_of_speech: e.part_of_speech?.trim() || null,
          one_word_en: e.one_word_en?.trim() || null,
          one_word_ur: e.one_word_ur?.trim() || null,
          synonym: e.synonym?.trim() || null,
          antonym: e.antonym?.trim() || null,
          definition_en: e.definition_en?.trim() || null,
          translation_ur: e.translation_ur?.trim() || null,
          example_en: e.example_en?.trim() || null,
          example_ur: e.example_ur?.trim() || null,
          examples: e.example_en?.trim() ? [{ en: e.example_en.trim(), ur: e.example_ur?.trim() || "" }] : [],
          tags: registerTag,
          collocations: [] as string[],
          notes: spectrumMeta ? (e.notes ? `${spectrumMeta}\n${e.notes}` : spectrumMeta) : (e.notes?.trim() || null),
        };
      });

      // Insert in batches of 100 to prevent timeouts/payload limit issues
      const chunkSize = 100;
      let count = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("words").insert(chunk);
        if (error) {
          console.error("Supabase insert error:", error);
          throw new Error(error.message || "Failed to insert words into database.");
        }
        count += chunk.length;
        setSavedCount(count);
      }

      await qc.invalidateQueries({ queryKey: ["words"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["review-queue"] });
      await qc.invalidateQueries({ queryKey: ["user-tags"] });
      await qc.refetchQueries({ queryKey: ["words"] });

      const msg =
        skippedCount > 0
          ? `${rows.length} entries imported, ${skippedCount} duplicate${skippedCount > 1 ? "s" : ""} skipped.`
          : `${rows.length} entries successfully imported!`;
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
      setStep("review");
    }
  };

  if (step === "saving") {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/words" })}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-display font-semibold">Importing</h1>
        </header>
        <Card className="p-10 text-center shadow-card">
          {savedCount < totalCount ? (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-display font-semibold">Saving to your library…</h2>
              <p className="text-muted-foreground mt-2">
                Saved {savedCount} of {totalCount} entries...
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-display font-semibold">Import complete!</h2>
              <p className="text-muted-foreground mt-2">
                {savedCount} entries added to your library.
              </p>
              <div className="flex gap-2 justify-center mt-6">
                <Button onClick={() => navigate({ to: "/words" })}>View words</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setEntries([]);
                    setFileName("");
                  }}
                >
                  Import another
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/words" })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-display font-semibold">Import vocabulary</h1>
      </header>

      {step === "upload" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className="p-8 text-center shadow-card border-dashed cursor-pointer hover:bg-muted/30 transition-colors flex flex-col justify-between"
            onClick={() => fileRef.current?.click()}
          >
            <div>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-display font-semibold">Upload a document</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Supports `.docx`, `.txt`, `.csv`, and `.md` files. Gemini will extract words
                automatically.
              </p>
            </div>
            <Button className="mt-5 w-full" variant="secondary">
              Choose file
            </Button>
          </Card>

          <Card
            className="p-8 text-center shadow-card border-dashed cursor-pointer hover:bg-muted/30 transition-colors flex flex-col justify-between"
            onClick={handleLocalCSVScan}
          >
            <div>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Database className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-display font-semibold">Scan local backups</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Scans existing files in `FlashCard/im v/` (`vocabulary_backup.csv`,
                `vocabulary_shortcut.csv`, `backup_vocab.csv`).
              </p>
            </div>
            <Button className="mt-5 w-full">Scan backups</Button>
          </Card>

          <input
            ref={fileRef}
            type="file"
            accept=".docx,.doc,.txt,.csv,.md"
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {step === "parsing" && (
        <Card className="p-10 text-center shadow-card">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-display font-semibold">Reading & analyzing…</h2>
          <p className="text-sm text-muted-foreground mt-2">Processing entries from {fileName}</p>
        </Card>
      )}

      {step === "review" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              {fileName} — {entries.length} found ({selectedCount} selected)
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={entries.length > 0 && entries.every((e) => e.selected)}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
                All
              </Label>
            </div>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {entries.slice(0, reviewLimit).map((entry, i) => (
              <Card
                key={i}
                className={`p-4 shadow-card transition-opacity ${entry.selected ? "" : "opacity-50"}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={entry.selected}
                    onCheckedChange={() => toggleSelect(i)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-lg">{entry.word}</h3>
                      {entry.type && (
                        <span
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[entry.type] || "bg-muted text-muted-foreground"}`}
                        >
                          {formatType(entry.type)}
                        </span>
                      )}
                      {entry.part_of_speech && (
                        <span className="text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {entry.part_of_speech}
                        </span>
                      )}
                    </div>
                    {(entry.one_word_en || entry.one_word_ur || entry.synonym || entry.antonym) && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px]">
                        {entry.one_word_en && (
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            = {entry.one_word_en}
                          </span>
                        )}
                        {entry.one_word_ur && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-urdu text-sm"
                            dir="rtl"
                          >
                            = {entry.one_word_ur}
                          </span>
                        )}
                        {entry.synonym && (
                          <span className="px-1.5 py-0.5 rounded bg-success/10 text-success">
                            syn: {entry.synonym}
                          </span>
                        )}
                        {entry.antonym && (
                          <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                            ant: {entry.antonym}
                          </span>
                        )}
                      </div>
                    )}
                    {entry.translation_ur && (
                      <p className="font-urdu text-xl mt-1 text-foreground" dir="rtl">
                        {entry.translation_ur}
                      </p>
                    )}
                    {entry.definition_en && (
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {entry.definition_en}
                      </p>
                    )}
                    {(entry.example_en || entry.example_ur) && (
                      <div className="mt-2 pl-3 border-l-2 border-accent/40 space-y-1">
                        {entry.example_en && (
                          <p className="text-sm italic text-foreground">"{entry.example_en}"</p>
                        )}
                        {entry.example_ur && (
                          <p className="font-urdu text-base" dir="rtl">
                            {entry.example_ur}
                          </p>
                        )}
                      </div>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-2">{entry.notes}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {entries.length > reviewLimit && (
              <div className="text-center py-4 bg-muted/20 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground mb-2">
                  Showing first {reviewLimit} of {entries.length} entries.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewLimit((prev) => prev + 200)}
                >
                  Show 200 more
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStep("upload");
                setEntries([]);
                setFileName("");
              }}
            >
              <X className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
            <Button className="flex-[2]" onClick={handleSave} disabled={selectedCount === 0}>
              <Save className="w-4 h-4 mr-1.5" /> Import {selectedCount} entry
              {selectedCount !== 1 ? "ies" : ""}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

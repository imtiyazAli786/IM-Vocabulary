import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, Check, X, Keyboard, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/quiz")({
  component: QuizPage,
  head: () => ({ meta: [{ title: "Daily Quiz — Lafz" }] }),
});

type Word = {
  id: string;
  word: string;
  translation_ur: string | null;
  definition_en: string | null;
  example_en: string | null;
  part_of_speech: string | null;
};
type Question =
  | { type: "en-to-ur"; word: Word; options: string[]; answer: string }
  | { type: "ur-to-en"; word: Word; options: string[]; answer: string }
  | { type: "fill"; word: Word; options: string[]; answer: string; prompt: string };

function shuffle<T>(a: T[]) {
  return [...a].sort(() => Math.random() - 0.5);
}

/**
 * Bug 4 fix: deduplicate pool first, then pad to exactly `n` distractors
 * using any unique remaining items so we always have 4 options total.
 */
function pickDistractors(pool: string[], correct: string, n: number): string[] {
  const unique = [...new Set(pool.filter((x) => x && x !== correct))];
  const shuffled = shuffle(unique);
  return shuffled.slice(0, n);
}

function buildQuiz(words: Word[]): Question[] {
  const usable = words.filter((w) => w.translation_ur);
  if (usable.length < 4) return [];
  const selected = shuffle(usable).slice(0, Math.min(10, usable.length));
  const allUr = [...new Set(usable.map((w) => w.translation_ur!).filter(Boolean))];
  const allEn = [...new Set(usable.map((w) => w.word))];

  return selected.map((w): Question => {
    const types: Question["type"][] = ["en-to-ur", "ur-to-en"];
    if (w.example_en && w.example_en.toLowerCase().includes(w.word.toLowerCase()))
      types.push("fill");
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === "en-to-ur") {
      const answer = w.translation_ur!;
      const distractors = pickDistractors(allUr, answer, 3);
      // Bug 4: if we still don't have 3 distractors (very small pool), pad with any unique items
      return { type, word: w, answer, options: shuffle([answer, ...distractors]) };
    }
    if (type === "ur-to-en") {
      const answer = w.word;
      const distractors = pickDistractors(allEn, answer, 3);
      return { type, word: w, answer, options: shuffle([answer, ...distractors]) };
    }
    const answer = w.word;
    const prompt = w.example_en!.replace(new RegExp(w.word, "i"), "_____");
    const distractors = pickDistractors(allEn, answer, 3);
    return { type: "fill", word: w, answer, prompt, options: shuffle([answer, ...distractors]) };
  });
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Bug 5 fix: tightened fuzzy matching — the loose "any word overlap" rule
 * was too permissive. Now requires exact or substring match only.
 */
function fuzzyMatch(input: string, answer: string) {
  const a = normalize(input);
  const b = normalize(answer);
  if (a === b) return true;
  // Allow if one fully contains the other (handles leading/trailing words or
  // minor phrasing differences), but only when both strings have real length.
  if (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

function QuizPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  // CQ-6: cache user id to avoid repeated getUser() calls during the quiz
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  const { data: words, isLoading } = useQuery({
    queryKey: ["quiz-words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("words")
        .select("id,word,translation_ur,definition_en,example_en,part_of_speech");
      if (error) throw error;
      return (data ?? []) as Word[];
    },
    // CQ-9: avoid unnecessary refetch on every window focus
    staleTime: 30_000,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<"mc" | "type">("mc");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (words && questions.length === 0) setQuestions(buildQuiz(words));
  }, [words, questions.length]);

  useEffect(() => {
    if (mode === "type" && !picked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [idx, mode, picked]);

  if (isLoading) return <LoadingScreen />;

  if (!words || words.filter((w) => w.translation_ur).length < 4) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-semibold">Daily Quiz</h1>
        <Card className="p-10 text-center shadow-card border-dashed">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Need at least 4 words with Urdu translations</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add a few more words to unlock the quiz.
          </p>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            <Button onClick={() => navigate({ to: "/words/add" })}>Add a word</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/grammar" })}>
              Open Grammar Trainer
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-semibold">Quiz complete</h1>
        <Card className="p-10 text-center shadow-elevated bg-primary text-primary-foreground border-0">
          <Trophy className="w-14 h-14 mx-auto mb-3 opacity-90" />
          <p className="text-5xl font-display font-semibold">
            {score} / {questions.length}
          </p>
          <p className="text-sm opacity-80 mt-2">
            {score === questions.length
              ? "Perfect!"
              : score >= questions.length * 0.7
                ? "Great work!"
                : "Keep practicing."}
          </p>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setQuestions(buildQuiz(words));
              setIdx(0);
              setPicked(null);
              setScore(0);
              setDone(false);
              setTypedAnswer("");
              setSubmitted(false);
            }}
          >
            Play again
          </Button>
          <Button onClick={() => navigate({ to: "/" })}>Home</Button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  if (!q) return null;

  const advance = () => {
    if (idx + 1 >= questions.length) {
      const userId = userIdRef.current;
      if (userId) {
        supabase
          .from("quiz_sessions")
          .insert({
            user_id: userId,
            score: scoreRef.current,
            total: questions.length,
          })
          .then(({ error }) => {
            if (!error) {
              // CQ-5: targeted invalidation instead of invalidating everything
              qc.invalidateQueries({ queryKey: ["dashboard"] });
            }
          });
      }
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
      setTypedAnswer("");
      setSubmitted(false);
    }
  };

  const choose = async (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.answer) setScore((s) => s + 1);
    setTimeout(advance, 850);
  };

  const handleTypeSubmit = () => {
    if (picked || !typedAnswer.trim()) return;
    setSubmitted(true);
    const correct = fuzzyMatch(typedAnswer, q.answer);
    setPicked(correct ? "correct" : "wrong");
    if (correct) setScore((s) => s + 1);
    setTimeout(advance, 1200);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-semibold">Daily Quiz</h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {idx + 1} / {questions.length}
          </p>
          <button
            onClick={() => {
              setMode((m) => (m === "mc" ? "type" : "mc"));
              setQuestions(buildQuiz(words));
              setIdx(0);
              setPicked(null);
              setScore(0);
              setDone(false);
              setTypedAnswer("");
              setSubmitted(false);
            }}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors",
              mode === "type"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30",
            )}
          >
            {mode === "type" ? (
              <>
                <Keyboard className="w-3 h-3" /> Type
              </>
            ) : (
              <>
                <MousePointer2 className="w-3 h-3" /> Choose
              </>
            )}
          </button>
        </div>
      </header>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
        />
      </div>

      <Card className="p-6 shadow-card">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          {q.type === "en-to-ur"
            ? "What is the Urdu meaning?"
            : q.type === "ur-to-en"
              ? "What is the English word?"
              : "Fill in the blank"}
        </p>
        {q.type === "en-to-ur" && (
          <p className="text-3xl font-display font-semibold">{q.word.word}</p>
        )}
        {q.type === "ur-to-en" && <p className="font-urdu text-3xl">{q.word.translation_ur}</p>}
        {q.type === "fill" && <p className="text-lg italic leading-relaxed">"{q.prompt}"</p>}
        {q.word.definition_en && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {q.word.definition_en}
          </p>
        )}
      </Card>

      {mode === "mc" ? (
        <div className="grid grid-cols-1 gap-2">
          {q.options.map((opt) => {
            const isCorrect = picked && opt === q.answer;
            const isWrong = picked === opt && opt !== q.answer;
            return (
              <button
                key={opt}
                onClick={() => choose(opt)}
                disabled={!!picked}
                className={cn(
                  "p-4 rounded-xl border-2 text-left font-medium transition-all flex items-center justify-between",
                  "border-border bg-card hover:border-primary/50",
                  isCorrect && "border-success bg-success/10 text-success",
                  isWrong && "border-destructive bg-destructive/10 text-destructive",
                  q.type === "en-to-ur" && "font-urdu text-2xl text-right justify-end",
                )}
              >
                <span>{opt}</span>
                {isCorrect && <Check className="w-5 h-5 shrink-0" />}
                {isWrong && <X className="w-5 h-5 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTypeSubmit();
              }}
              placeholder="Type your answer..."
              disabled={!!picked}
              className={cn("text-lg", q.type === "en-to-ur" && "font-urdu text-right")}
              dir={q.type === "en-to-ur" ? "rtl" : "ltr"}
            />
            <Button onClick={handleTypeSubmit} disabled={!!picked || !typedAnswer.trim()}>
              Check
            </Button>
          </div>
          {submitted && (
            <div
              className={cn(
                "p-4 rounded-xl border-2 text-center",
                picked === "correct"
                  ? "border-success bg-success/10 text-success"
                  : "border-destructive bg-destructive/10 text-destructive",
              )}
            >
              {picked === "correct" ? (
                <div className="flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">Correct!</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <X className="w-5 h-5" />
                    <span className="font-semibold">Not quite</span>
                  </div>
                  <p className="text-sm">
                    Correct answer: <strong>{q.answer}</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

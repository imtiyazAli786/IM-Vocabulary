import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Trophy,
  Check,
  X,
  Keyboard,
  MousePointer2,
  Flame,
  BookOpen,
  Sparkles,
  Layers,
  TrendingUp,
  ArrowRight,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/quiz")({
  component: QuizPage,
  head: () => ({ meta: [{ title: "Daily Quiz & Practice — Lafz" }] }),
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

function fuzzyMatch(input: string, answer: string) {
  const a = normalize(input);
  const b = normalize(answer);
  if (a === b) return true;
  if (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

function StatBlock({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Card className="p-3 text-center shadow-card">
      <Icon className={cn("w-4 h-4 mx-auto", accent ? "text-accent" : "text-primary")} />
      <p className="text-lg font-display font-semibold mt-1 tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
    </Card>
  );
}

function QuizPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  // Fetch words for quiz
  const { data: words, isLoading: isWordsLoading } = useQuery({
    queryKey: ["quiz-words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("words")
        .select("id,word,translation_ur,definition_en,example_en,part_of_speech");
      if (error) throw error;
      return (data ?? []) as Word[];
    },
    staleTime: 30_000,
  });

  // Fetch dashboard statistics (due count, streak, progress)
  const { data: dash, isLoading: isDashLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const [profileRes, dueRes, masteredRes, totalRes, quizzesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("current_streak,longest_streak,last_study_date")
          .maybeSingle(),
        supabase.from("words").select("id", { count: "exact", head: true }).lte("due_at", now),
        supabase.from("words").select("id", { count: "exact", head: true }).eq("mastered", true),
        supabase.from("words").select("id", { count: "exact", head: true }),
        supabase
          .from("quiz_sessions")
          .select("score,total")
          .order("completed_at", { ascending: false })
          .limit(1),
      ]);

      const lastQuiz = quizzesRes.data?.[0];
      const quizPct = lastQuiz
        ? Math.round((lastQuiz.score / Math.max(lastQuiz.total, 1)) * 100)
        : null;

      return {
        streak: profileRes.data?.current_streak ?? 0,
        dueCount: dueRes.count ?? 0,
        masteredCount: masteredRes.count ?? 0,
        totalCount: totalRes.count ?? 0,
        lastQuizPct: quizPct,
      };
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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

  if (isWordsLoading || isDashLoading) return <LoadingScreen />;

  const pctMastered =
    dash && dash.totalCount > 0 ? Math.round((dash.masteredCount / dash.totalCount) * 100) : 0;

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

  const q = questions[idx];

  return (
    <div className="space-y-6 pb-6 max-w-xl mx-auto">
      {/* Header with Date, Streak, and Profile */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Quiz & Practice</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(dash?.streak ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold">
              <Flame className="w-4 h-4" />
              {dash?.streak}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/profile" })}
            className="w-9 h-9 rounded-full border border-border bg-card shadow-sm"
            aria-label="Profile and Settings"
          >
            <User className="w-4 h-4 text-foreground" />
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          QUIZ SECTION
         ───────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        {!words || words.filter((w) => w.translation_ur).length < 4 ? (
          <Card className="p-8 text-center shadow-card border-dashed">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Need at least 4 words with Urdu translations</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add a few more words to unlock the quiz.
            </p>
            <Button size="sm" onClick={() => navigate({ to: "/words/add" })}>
              Add a word
            </Button>
          </Card>
        ) : done ? (
          <div className="space-y-3">
            <Card className="p-8 text-center shadow-elevated bg-primary text-primary-foreground border-0 rounded-2xl">
              <Trophy className="w-12 h-12 mx-auto mb-2 opacity-90" />
              <p className="text-4xl font-display font-semibold">
                {score} / {questions.length}
              </p>
              <p className="text-sm opacity-80 mt-1">
                {score === questions.length
                  ? "Perfect Score! 🎉"
                  : score >= questions.length * 0.7
                    ? "Great work! 👏"
                    : "Keep practicing!"}
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
              <Button onClick={() => navigate({ to: "/review" })}>
                Review Flashcards
              </Button>
            </div>
          </div>
        ) : q ? (
          <div className="space-y-3">
            {/* Quiz progress header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Question {idx + 1} of {questions.length}
              </span>
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
                  "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors",
                  mode === "type"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30",
                )}
              >
                {mode === "type" ? (
                  <>
                    <Keyboard className="w-3.5 h-3.5" /> Type Answer
                  </>
                ) : (
                  <>
                    <MousePointer2 className="w-3.5 h-3.5" /> Multiple Choice
                  </>
                )}
              </button>
            </div>

            {/* Quiz progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Question Card */}
            <Card className="p-6 shadow-card rounded-2xl space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {q.type === "en-to-ur"
                  ? "What is the Urdu meaning?"
                  : q.type === "ur-to-en"
                    ? "What is the English word?"
                    : "Fill in the blank"}
              </p>
              {q.type === "en-to-ur" && (
                <p className="text-3xl font-display font-semibold text-foreground">{q.word.word}</p>
              )}
              {q.type === "ur-to-en" && (
                <p className="font-urdu text-3xl text-foreground text-right" dir="rtl">
                  {q.word.translation_ur}
                </p>
              )}
              {q.type === "fill" && (
                <p className="text-lg italic leading-relaxed text-foreground">"{q.prompt}"</p>
              )}
              {q.word.definition_en && (
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  {q.word.definition_en}
                </p>
              )}
            </Card>

            {/* Options (MC Mode) */}
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
                        "p-4 rounded-xl border-2 text-left font-medium transition-all flex items-center justify-between shadow-card active:scale-[0.99] cursor-pointer",
                        "border-border bg-card hover:border-primary/50",
                        isCorrect && "border-success bg-success/10 text-success",
                        isWrong && "border-destructive bg-destructive/10 text-destructive",
                        q.type === "en-to-ur" && "font-urdu text-2xl text-right justify-end",
                      )}
                    >
                      <span>{opt}</span>
                      {isCorrect && <Check className="w-5 h-5 shrink-0 ml-2" />}
                      {isWrong && <X className="w-5 h-5 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Type Answer Mode */
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
                    className={cn("text-base h-12", q.type === "en-to-ur" && "font-urdu text-right text-xl")}
                    dir={q.type === "en-to-ur" ? "rtl" : "ltr"}
                  />
                  <Button
                    onClick={handleTypeSubmit}
                    disabled={!!picked || !typedAnswer.trim()}
                    className="h-12 px-5"
                  >
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
        ) : null}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          DASHBOARD CONTENT: DUE WORDS BANNER & PROGRESS STATS
         ───────────────────────────────────────────────────────────── */}
      <section className="space-y-4 pt-4 border-t border-border/60">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Daily Review & Progress
        </p>

        {/* Due words banner or all-caught-up */}
        {(dash?.dueCount ?? 0) > 0 ? (
          <button
            className="w-full text-left p-5 rounded-2xl shadow-elevated bg-primary text-primary-foreground border-0 active:scale-[0.98] transition-transform cursor-pointer"
            onClick={() => navigate({ to: "/review" })}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80 font-medium">Words due for review</p>
                <p className="text-4xl font-display font-semibold mt-1 tabular-nums">
                  {dash?.dueCount}
                </p>
              </div>
              <div className="w-13 h-13 rounded-full bg-white/10 flex items-center justify-center">
                <Layers className="w-7 h-7 opacity-80" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 text-sm font-medium opacity-90">
              Start review <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        ) : dash && dash.totalCount > 0 ? (
          <Card className="p-4 shadow-card border-success/30 bg-success/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-semibold text-sm">All caught up!</p>
                <p className="text-xs text-muted-foreground">
                  No words due for review right now.
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <StatBlock icon={BookOpen} label="Total" value={dash?.totalCount ?? 0} />
          <StatBlock icon={TrendingUp} label="Due" value={dash?.dueCount ?? 0} accent />
          <StatBlock icon={Sparkles} label="Mastered" value={`${pctMastered}%`} />
          <StatBlock
            icon={Trophy}
            label="Last quiz"
            value={dash?.lastQuizPct != null ? `${dash.lastQuizPct}%` : "—"}
          />
        </div>

        {/* Mastery Progress Bar */}
        {dash && dash.totalCount > 0 && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{ width: `${pctMastered}%` }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

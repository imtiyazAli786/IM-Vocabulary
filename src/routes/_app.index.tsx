import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Flame,
  BookOpen,
  Sparkles,
  Trophy,
  Layers,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  ChevronRight,
  User,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Home — Lafz" }] }),
});

type WeakWord = {
  id: string;
  word: string;
  repetitions: number;
  ease: number;
  translation_ur: string | null;
  definition_en: string | null;
};

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

function DashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const [profileRes, dueRes, masteredRes, totalRes, quizzesRes, weakRes] = await Promise.all([
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
        supabase
          .from("words")
          .select("id,word,repetitions,ease,translation_ur,definition_en")
          .not("mastered", "eq", true)
          .order("repetitions", { ascending: true })
          .limit(5),
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
        weakWords: (weakRes.data ?? []) as WeakWord[],
      };
    },
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <LoadingScreen />;

  const pctMastered =
    data && data.totalCount > 0 ? Math.round((data.masteredCount / data.totalCount) * 100) : 0;

  return (
    <div className="space-y-5 pb-4">
      {/* Header with streak and profile button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Lafz</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(data?.streak ?? 0) > 1 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold">
              <Flame className="w-4 h-4" />
              {data?.streak}
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

      {/* Due words banner or all-caught-up */}
      {(data?.dueCount ?? 0) > 0 ? (
        <button
          className="w-full text-left p-5 rounded-xl shadow-elevated bg-primary text-primary-foreground border-0 active:scale-[0.98] transition-transform cursor-pointer"
          onClick={() => navigate({ to: "/review" })}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 font-medium">Words due for review</p>
              <p className="text-5xl font-display font-semibold mt-1 tabular-nums">
                {data?.dueCount}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <Layers className="w-7 h-7 opacity-80" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm font-medium opacity-90">
            Start review <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      ) : data && data.totalCount > 0 ? (
        <Card className="p-5 shadow-card border-success/30 bg-success/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-success/20 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-semibold">All caught up!</p>
              <p className="text-sm text-muted-foreground">
                No words due. Take a quiz or add more.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5 shadow-card border-dashed">
          <div className="text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-semibold">Your vocabulary is empty</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Import or add your first word to get started.
            </p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={() => navigate({ to: "/words/add" })}>
                Add word
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/import" })}>
                Import
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Progress
        </p>
        <div className="grid grid-cols-4 gap-2">
          <StatBlock icon={BookOpen} label="Total" value={data?.totalCount ?? 0} />
          <StatBlock icon={TrendingUp} label="Due" value={data?.dueCount ?? 0} accent />
          <StatBlock icon={Sparkles} label="Mastered" value={`${pctMastered}%`} />
          <StatBlock
            icon={Trophy}
            label="Last quiz"
            value={data?.lastQuizPct != null ? `${data.lastQuizPct}%` : "—"}
          />
        </div>
        {/* Mastery progress bar */}
        {data && data.totalCount > 0 && (
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{ width: `${pctMastered}%` }}
            />
          </div>
        )}
      </div>

      {/* Weak words */}
      {data && data.weakWords.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-warning" />
              Needs practice
            </p>
            <button
              className="text-xs text-primary font-medium flex items-center gap-0.5"
              onClick={() => navigate({ to: "/words" })}
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {data.weakWords.map((w) => (
              <button
                key={w.id}
                className="w-full text-left p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors active:scale-[0.99] cursor-pointer"
                onClick={() => navigate({ to: "/words/$id", params: { id: w.id } })}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{w.word}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
                        x{w.repetitions}
                      </span>
                    </div>
                    <p className="font-urdu text-base text-muted-foreground mt-0.5" dir="rtl">
                      {w.translation_ur ?? w.definition_en ?? ""}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

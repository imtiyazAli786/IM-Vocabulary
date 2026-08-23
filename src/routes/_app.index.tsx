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
  ChevronRight,
  User,
  Plus,
  MessageSquareQuote,
  Zap,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Home — Lafz" }] }),
});

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
                No words due for review. Take a quiz or practice sentences.
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

      {/* Quick Actions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Practice & Actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => navigate({ to: "/quiz" })}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-all text-left shadow-card active:scale-[0.99] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Take a Quiz</p>
              <p className="text-xs text-muted-foreground truncate">10 multiple choice questions</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          <button
            onClick={() => navigate({ to: "/sentences" })}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-all text-left shadow-card active:scale-[0.99] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MessageSquareQuote className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Sentence Bank</p>
              <p className="text-xs text-muted-foreground truncate">Read words in bilingual context</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          <button
            onClick={() => navigate({ to: "/words/add" })}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-all text-left shadow-card active:scale-[0.99] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Add New Word</p>
              <p className="text-xs text-muted-foreground truncate">With instant AI definitions</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { localDb } from "@/lib/local-db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Flame, BookOpen, Sparkles, LogOut, Trophy, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { regenerateAllUrduOneWord } from "@/lib/regenerate-urdu.functions";
import { UpgradeFormalityModal } from "@/components/UpgradeFormalityModal";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Lafz" }] }),
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const regenerate = useServerFn(regenerateAllUrduOneWord);
  const [regenBusy, setRegenBusy] = useState(false);
  const isGuest = localDb.isGuest();

  const { data } = useQuery({
    queryKey: ["profile-stats"],
    queryFn: async () => {
      const [profileRes, wordsRes, masteredRes, quizzesRes] = await Promise.all([
        supabase.from("profiles").select("*").maybeSingle(),
        supabase.from("words").select("id", { count: "exact", head: true }),
        supabase.from("words").select("id", { count: "exact", head: true }).eq("mastered", true),
        supabase.from("quiz_sessions").select("score,total").order("completed_at", { ascending: false }).limit(7),
      ]);
      const recent = quizzesRes.data ?? [];
      const avg = recent.length ? recent.reduce((s, r) => s + (r.score / Math.max(r.total, 1)), 0) / recent.length : 0;
      return {
        profile: profileRes.data,
        total: wordsRes.count ?? 0,
        mastered: masteredRes.count ?? 0,
        recentQuizzes: recent.length,
        avgScore: Math.round(avg * 100),
      };
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-2xl font-display font-semibold">Profile</h1>

      <Card className="p-6 shadow-card text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-display font-semibold">
          {data?.profile?.display_name?.[0]?.toUpperCase() ?? (isGuest ? "G" : "?")}
        </div>
        <p className="mt-3 font-display text-xl font-semibold">
          {data?.profile?.display_name ?? (isGuest ? "Guest User" : "—")}
        </p>
        {isGuest && (
          <span className="inline-block mt-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            Local Browser Storage
          </span>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatBlock icon={Flame} label="Current streak" value={`${data?.profile?.current_streak ?? 0} days`} accent />
        <StatBlock icon={Trophy} label="Longest streak" value={`${data?.profile?.longest_streak ?? 0} days`} />
        <StatBlock icon={BookOpen} label="Total words" value={data?.total ?? 0} />
        <StatBlock icon={Sparkles} label="Mastered" value={data?.mastered ?? 0} />
      </div>

      <Card className="p-5 shadow-card">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Last 7 quizzes</p>
        <p className="text-3xl font-display font-semibold mt-2">{data?.avgScore ?? 0}%</p>
        <p className="text-sm text-muted-foreground mt-1">Average accuracy</p>
      </Card>

      {/* Vocabulary Tools Card */}
      <Card className="p-5 shadow-card space-y-3">
        <div>
          <p className="font-display font-semibold">Vocabulary Tools</p>
          <p className="text-sm text-muted-foreground mt-1">
            Organize and regenerate AI content across your saved words.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <UpgradeFormalityModal />

          <Button
            variant="outline"
            size="sm"
            disabled={regenBusy}
            className="flex-1 text-xs gap-1.5"
            onClick={async () => {
              setRegenBusy(true);
              const tid = toast.loading("Regenerating Urdu meanings…");
              try {
                const r = await regenerate();
                toast.success(`Updated ${r.updated} of ${r.total}${r.failed ? ` (${r.failed} failed)` : ""}`, { id: tid });
                qc.invalidateQueries();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to regenerate", { id: tid });
              } finally {
                setRegenBusy(false);
              }
            }}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{regenBusy ? "Regenerating…" : "Regenerate Urdu Meanings"}</span>
          </Button>
        </div>
      </Card>

      {/* Sign Out with Guest Protection */}
      {isGuest ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4 mr-2" /> Sign out (Guest Mode)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out and erase guest data?</AlertDialogTitle>
              <AlertDialogDescription>
                You are currently in Guest Mode. Signing out will permanently wipe all your saved words and practice history on this device.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep My Data</AlertDialogCancel>
              <AlertDialogAction
                onClick={signOut}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sign out & Erase Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      )}
    </div>
  );
}

function StatBlock({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4 shadow-card">
      <Icon className={`w-4 h-4 ${accent ? "text-highlight" : "text-primary"}`} />
      <p className="text-xl font-display font-semibold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}


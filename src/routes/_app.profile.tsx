import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flame, BookOpen, Sparkles, LogOut, Trophy, Wand2, Cpu, Check, Eye, EyeOff, Key, Zap } from "lucide-react";
import { toast } from "sonner";
import { regenerateAllUrduOneWord } from "@/lib/regenerate-urdu.functions";
import { testAiKey } from "@/lib/ai.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Lafz" }] }),
});

const STORAGE_CUSTOM_KEY = "lafz_custom_ai_key";
const STORAGE_CUSTOM_PROVIDER = "lafz_custom_ai_provider";
const STORAGE_CUSTOM_MODEL = "lafz_custom_ai_model";

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const regenerate = useServerFn(regenerateAllUrduOneWord);
  const testKeyFn = useServerFn(testAiKey);

  const [regenBusy, setRegenBusy] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<"nvidia" | "openrouter" | "gemini">(() => {
    try {
      if (typeof window === "undefined") return "nvidia";
      return (localStorage.getItem(STORAGE_CUSTOM_PROVIDER) as any) || "nvidia";
    } catch {
      return "nvidia";
    }
  });

  const [apiKeyInput, setApiKeyInput] = useState<string>(() => {
    try {
      if (typeof window === "undefined") return "";
      return localStorage.getItem(STORAGE_CUSTOM_KEY) || "";
    } catch {
      return "";
    }
  });

  const [customModelInput, setCustomModelInput] = useState<string>(() => {
    try {
      if (typeof window === "undefined") return "nvidia/nemotron-3-ultra-550b-a55b";
      return localStorage.getItem(STORAGE_CUSTOM_MODEL) || "nvidia/nemotron-3-ultra-550b-a55b";
    } catch {
      return "nvidia/nemotron-3-ultra-550b-a55b";
    }
  });

  const [isSaved, setIsSaved] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      return !!localStorage.getItem(STORAGE_CUSTOM_KEY);
    } catch {
      return false;
    }
  });

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

  const handleSaveKey = () => {
    if (!apiKeyInput.trim()) {
      localStorage.removeItem(STORAGE_CUSTOM_KEY);
      localStorage.removeItem(STORAGE_CUSTOM_PROVIDER);
      localStorage.removeItem(STORAGE_CUSTOM_MODEL);
      setIsSaved(false);
      toast.success("Custom API key removed. Using default engine.");
      return;
    }
    localStorage.setItem(STORAGE_CUSTOM_KEY, apiKeyInput.trim());
    localStorage.setItem(STORAGE_CUSTOM_PROVIDER, selectedProvider);
    localStorage.setItem(STORAGE_CUSTOM_MODEL, customModelInput.trim());
    setIsSaved(true);
    toast.success(`Saved ${selectedProvider.toUpperCase()} (${customModelInput.trim()}) key!`);
  };

  const handleTestKey = async () => {
    if (!apiKeyInput.trim()) {
      toast.error("Please enter an API key first.");
      return;
    }
    setTestingKey(true);
    const tid = toast.loading("Testing API connection…");
    try {
      const res = await testKeyFn({
        data: {
          key: apiKeyInput.trim(),
          provider: selectedProvider,
          model: customModelInput.trim(),
        },
      });
      toast.success(
        `Connected to ${res.model} (${res.latencyMs}ms)!`,
        { id: tid }
      );
      handleSaveKey();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection test failed", { id: tid });
    } finally {
      setTestingKey(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-semibold">Profile</h1>

      <Card className="p-6 shadow-card text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-display font-semibold">
          {data?.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <p className="mt-3 font-display text-xl font-semibold">{data?.profile?.display_name ?? "—"}</p>
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

      {/* AI Translation & API Key Settings Card */}
      <Card className="p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <div>
              <p className="font-display font-semibold">AI Translation Engine</p>
              <p className="text-xs text-muted-foreground">
                Configure your NVIDIA Nemotron, OpenRouter, or Gemini key
              </p>
            </div>
          </div>
          {isSaved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <Check className="w-3 h-3" /> Active
            </span>
          )}
        </div>

        {/* Provider Tabs */}
        <div>
          <Label className="text-xs font-semibold block mb-1.5">Select Provider</Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedProvider("nvidia");
                if (!customModelInput || customModelInput.includes("gemini")) {
                  setCustomModelInput("nvidia/llama-3.1-nemotron-70b-instruct");
                }
              }}
              className={cn(
                "py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer",
                selectedProvider === "nvidia"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-600/20"
                  : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="font-bold text-[11px]">NVIDIA NIM</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedProvider("openrouter");
                setCustomModelInput("nvidia/nemotron-3-ultra-550b-a55b");
              }}
              className={cn(
                "py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer",
                selectedProvider === "openrouter"
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-600/20"
                  : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
              )}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="font-bold text-[11px]">OpenRouter</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedProvider("gemini");
                setCustomModelInput("gemini-2.5-flash-lite");
              }}
              className={cn(
                "py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer",
                selectedProvider === "gemini"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20"
                  : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-bold text-[11px]">Gemini</span>
            </button>
          </div>
        </div>

        {/* Model ID Input */}
        <div className="space-y-1.5">
          <Label htmlFor="model-id" className="text-xs font-semibold">
            Model Identifier
          </Label>
          <Input
            id="model-id"
            value={customModelInput}
            onChange={(e) => setCustomModelInput(e.target.value)}
            placeholder="e.g. nvidia/nemotron-3-ultra-550b-a55b"
            className="h-10 text-sm font-mono"
          />
        </div>

        {/* API Key Input */}
        <div className="space-y-1.5">
          <Label htmlFor="api-key" className="text-xs font-semibold flex items-center gap-1">
            <Key className="w-3.5 h-3.5 text-muted-foreground" />
            API Key
          </Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              placeholder={
                selectedProvider === "nvidia"
                  ? "nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  : selectedProvider === "openrouter"
                  ? "sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  : "AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              }
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setIsSaved(false);
              }}
              className="pr-10 h-10 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              title={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestKey}
            disabled={testingKey || !apiKeyInput.trim()}
            className="flex-1 text-xs h-9"
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            {testingKey ? "Testing…" : "Test Connection"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveKey}
            className="flex-1 text-xs h-9"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Save Key
          </Button>
        </div>
      </Card>

      <Card className="p-5 shadow-card space-y-3">
        <div>
          <p className="font-display font-semibold">Refresh Urdu meanings</p>
          <p className="text-sm text-muted-foreground mt-1">
            Regenerate simple, everyday Urdu one-word meanings for all your saved words.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={regenBusy}
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
          <Wand2 className="w-4 h-4 mr-2" /> {regenBusy ? "Regenerating…" : "Regenerate all Urdu meanings"}
        </Button>
      </Card>

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="w-4 h-4 mr-2" /> Sign out
      </Button>
    </div>
  );
}

function StatBlock({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4 shadow-card">
      <Icon className={`w-4 h-4 ${accent ? "text-accent" : "text-primary"}`} />
      <p className="text-xl font-display font-semibold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

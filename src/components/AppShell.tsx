import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, MessageSquareQuote, Layers, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/words", icon: BookOpen, label: "Words" },
  { to: "/sentences", icon: MessageSquareQuote, label: "Sentences" },
  { to: "/review", icon: Layers, label: "Review" },
  { to: "/quiz", icon: Trophy, label: "Quiz" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <main
        className="mx-auto max-w-xl px-4 pt-3"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
      >
        {children}
      </main>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-xl grid grid-cols-5">
          {nav.map(({ to, icon: Icon, label }) => {
            const active = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] font-medium transition-colors active:bg-accent/10",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

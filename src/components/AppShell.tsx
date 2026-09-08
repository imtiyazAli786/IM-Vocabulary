import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, MessageSquareQuote, Layers, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/review", icon: Layers, label: "Review" },
  { to: "/words", icon: BookOpen, label: "Words" },
  { to: "/sentences", icon: MessageSquareQuote, label: "Sentences" },
  { to: "/quiz", icon: Trophy, label: "Quiz" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <header
        className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-xl px-4 h-11 flex items-center justify-between">
          <Link to="/review" className="flex items-center gap-2 group transition-opacity hover:opacity-90">
            <img
              src="/favicon.svg"
              alt="Lafz"
              className="w-6 h-6 rounded-lg shadow-xs transition-transform group-hover:scale-105"
            />
            <span className="font-display font-semibold text-base text-foreground tracking-tight">
              Lafz
            </span>
          </Link>
        </div>
      </header>
      <main
        className="mx-auto max-w-xl px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5.25rem)",
        }}
      >
        {children}
      </main>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur-md shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-xl grid grid-cols-5 px-1.5 py-1">
          {nav.map(({ to, icon: Icon, label }) => {
            const active = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center py-1 min-h-[54px] text-[11px] font-medium transition-all group rounded-xl",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Active Icon Pill Background Indicator */}
                <div
                  className={cn(
                    "px-4 py-1 rounded-full flex items-center justify-center transition-all duration-200",
                    active
                      ? "bg-primary/15 text-primary scale-105 shadow-sm ring-1 ring-primary/25"
                      : "group-hover:bg-muted/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform",
                      active ? "stroke-[2.5] text-primary" : "stroke-[1.75]"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "mt-0.5 text-[11px] transition-all",
                    active
                      ? "font-bold text-primary tracking-tight"
                      : "font-medium text-muted-foreground opacity-80"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

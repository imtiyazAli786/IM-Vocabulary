import { FormalitySpectrumData, CATEGORY_CONFIG, PermanentCategory } from "@/lib/formality";
import { speak } from "@/lib/speech";
import { Volume2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormalitySpectrumProps {
  data: FormalitySpectrumData;
  headword: string;
  className?: string;
}

export function FormalitySpectrum({ data, headword, className }: FormalitySpectrumProps) {
  const currentCat = data.category || "daily-life";

  const rows: Array<{
    key: PermanentCategory;
    title: string;
    sub: string;
    icon: string;
    val: string;
  }> = [
    {
      key: "daily-life",
      title: "Daily Life",
      sub: "Home, Friends, Shows",
      icon: "🏠",
      val: data.informal || (currentCat === "daily-life" ? headword : ""),
    },
    {
      key: "workplace",
      title: "Workplace",
      sub: "Office & Meetings",
      icon: "💼",
      val: data.neutral || (currentCat === "workplace" ? headword : ""),
    },
    {
      key: "news-reading",
      title: "News Reading",
      sub: "Articles & Formal",
      icon: "📰",
      val: data.formal || (currentCat === "news-reading" ? headword : ""),
    },
  ];

  const hasValues = rows.some((r) => r.val && r.val.trim().length > 0);
  if (!hasValues) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-muted/20 p-3 sm:p-3.5 space-y-2 text-left shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary" /> Usage Spectrum
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
            CATEGORY_CONFIG[currentCat]?.colorBadge || "bg-muted text-muted-foreground"
          )}
        >
          {CATEGORY_CONFIG[currentCat]?.shortLabel || "Category"}
        </span>
      </div>

      <div className="divide-y divide-border/40 text-xs sm:text-sm">
        {rows.map((r) => {
          const isActive = r.key === currentCat;
          const displayVal = r.val || "—";
          return (
            <div
              key={r.key}
              className={cn(
                "py-1.5 px-2 rounded-lg flex items-center justify-between gap-2 transition-colors",
                isActive ? "bg-card shadow-sm font-semibold border border-border/60" : "opacity-80"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0">{r.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{r.title}</span>
                    <span className="text-[10px] text-muted-foreground hidden xs:inline">
                      ({r.sub})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "text-xs sm:text-sm font-medium tracking-tight",
                    isActive ? "text-primary font-bold" : "text-foreground"
                  )}
                >
                  {displayVal}
                </span>
                {displayVal !== "—" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 rounded-full hover:bg-muted/80 p-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(displayVal);
                    }}
                    title={`Pronounce ${displayVal}`}
                  >
                    <Volume2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

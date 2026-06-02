import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Compact KPI card for the dashboard bento grid. Value uses tabular figures so
 * columns line up and never shift. Accent tile color is semantic per metric.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accentClass = "bg-primary/15 text-primary ring-primary/25",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accentClass?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-md transition-colors hover:border-white/20 sm:p-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
            accentClass
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default KpiCard;

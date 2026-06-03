import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Icon3D, type Icon3DTone } from "@/components/shared/Icon3D";

/**
 * Glassmorphic KPI card used across dashboards and the landing page.
 * `value` is pre-formatted by the caller (e.g. via formatCurrency).
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Icon tile tone. */
  tone?: Icon3DTone;
  /** Small supporting line under the value. */
  hint?: string;
  /** Optional trend indicator (e.g. "+12% this month"). */
  trend?: {
    value: string;
    direction?: "up" | "down" | "neutral";
  };
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  hint,
  trend,
  className,
}: StatCardProps) {
  const direction = trend?.direction ?? "neutral";
  const TrendIcon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : null;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-white/10 bg-white/[0.055] shadow-xl shadow-black/10 backdrop-blur-xl",
        "min-h-[150px] p-5 transition-colors hover:border-white/20",
        className
      )}
    >
      {/* Subtle top sheen */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon3D icon={Icon} tone={tone} size={40} />}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
              direction === "up" &&
                "bg-cyan-500/10 text-cyan-300",
              direction === "down" && "bg-red-500/10 text-red-400",
              direction === "neutral" &&
                "bg-white/5 text-muted-foreground"
            )}
          >
            {TrendIcon && <TrendIcon className="h-3 w-3" aria-hidden="true" />}
            {trend.value}
          </span>
        )}
      </div>

      {hint && (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </Card>
  );
}

export default StatCard;

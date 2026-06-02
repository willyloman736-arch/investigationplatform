import { ArrowUpRight, Wallet } from "lucide-react";

import { cn, formatCurrency } from "@/lib/utils";
import { Sparkline } from "@/components/dashboard/Sparkline";

/**
 * "Portfolio"-style hero card: total value held in escrow, a trend sparkline,
 * and the two figures that matter most (net releasable + active contracts).
 * Numbers are tabular so they never shift. The trend is illustrative for the MVP.
 */
export function EscrowPortfolioCard({
  total,
  currency,
  trend,
  netReleasable,
  activeContracts,
  deltaLabel,
  className,
}: {
  total: number;
  currency: string;
  trend: number[];
  netReleasable: number;
  activeContracts: number;
  deltaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md sm:p-6",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Total in escrow
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
            {formatCurrency(total, currency)}
          </p>
        </div>
        {deltaLabel ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            {deltaLabel}
          </span>
        ) : null}
      </div>

      <div className="relative mt-4">
        <Sparkline data={trend} className="h-20 w-full" />
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Escrow value over time (illustrative)
        </p>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Net releasable</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-cyan-300">
            {formatCurrency(netReleasable, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Active contracts</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {activeContracts}
          </p>
        </div>
      </div>
    </div>
  );
}

export default EscrowPortfolioCard;

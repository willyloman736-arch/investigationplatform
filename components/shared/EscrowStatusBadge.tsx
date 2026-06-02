import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ESCROW_STATUS_CONFIG } from "@/lib/constants";
import type { EscrowStatus } from "@/lib/types";

/**
 * Canonical escrow status pill. Always render escrow states through this so the
 * label + colors stay consistent with ESCROW_STATUS_CONFIG everywhere.
 */
export interface EscrowStatusBadgeProps {
  status: EscrowStatus;
  className?: string;
  /** Hide the leading colored dot if false. Defaults to true. */
  showDot?: boolean;
}

export function EscrowStatusBadge({
  status,
  className,
  showDot = true,
}: EscrowStatusBadgeProps) {
  const config = ESCROW_STATUS_CONFIG[status];

  // Defensive fallback for an unknown status value (should not happen with typed
  // data, but keeps the UI from crashing on bad input).
  if (!config) {
    return (
      <Badge
        variant="outline"
        className={cn("gap-1.5 font-semibold tracking-wide", className)}
      >
        {String(status).toUpperCase()}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap",
        config.badgeClass,
        className
      )}
      title={config.description}
    >
      {showDot && (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            config.dotClass
          )}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  );
}

export default EscrowStatusBadge;

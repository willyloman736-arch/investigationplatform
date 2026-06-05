import * as React from "react";
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { cn, formatCurrency } from "@/lib/utils";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import type { CaseWithRelations, EscrowStatus, PlatformStats } from "@/lib/types";
import { StatCard } from "@/components/shared/StatCard";

export interface StatusSummaryCardsProps {
  /**
   * Cases (ideally with their `escrow` relation populated) used to derive the
   * per-status counts and an aggregate value fallback.
   */
  cases?: CaseWithRelations[];
  /**
   * Optional precomputed platform stats. When provided, its
   * `totalTransactedPool` is preferred for the "Total Value" card.
   */
  stats?: PlatformStats;
  className?: string;
}

interface Derived {
  activeEscrow: number;
  pendingDeposit: number;
  underDispute: number;
  totalValue: number;
  currency: string;
}

/** "Active escrow" = funds confirmed held and not yet released/disputed. */
const ACTIVE_ESCROW_STATUSES: ReadonlySet<EscrowStatus> = new Set<EscrowStatus>([
  "securely_escrowed",
  "ready_for_release",
  "release_approved",
  "release_frozen",
]);

function derive(
  cases: CaseWithRelations[] | undefined,
  stats: PlatformStats | undefined
): Derived {
  let activeEscrow = 0;
  let pendingDeposit = 0;
  let underDispute = 0;
  let totalValue = 0;
  let currency = stats?.currency ?? DEFAULT_CURRENCY;

  for (const c of cases ?? []) {
    const escrow = c.escrow;
    if (!escrow) continue;
    if (escrow.currency) currency = escrow.currency;

    if (ACTIVE_ESCROW_STATUSES.has(escrow.escrow_status)) activeEscrow += 1;
    if (escrow.escrow_status === "pending_deposit") pendingDeposit += 1;
    if (escrow.escrow_status === "under_dispute_audit") underDispute += 1;

    // Aggregate held value (display only — no balance arithmetic on funds).
    totalValue += Number(escrow.total_amount) || 0;
  }

  return {
    activeEscrow,
    pendingDeposit,
    underDispute,
    totalValue: stats?.totalTransactedPool ?? totalValue,
    currency,
  };
}

/**
 * Top-of-dashboard summary cards. Built from the shared <StatCard /> so styling
 * stays consistent across client and admin views. Responsive grid: 1 col on
 * mobile → 2 on small → 4 on large, never overflowing horizontally.
 */
export function StatusSummaryCards({
  cases,
  stats,
  className,
}: StatusSummaryCardsProps) {
  const d = derive(cases, stats);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      <StatCard
        label="Active Escrow"
        value={d.activeEscrow}
        icon={ShieldCheck}
        tone="emerald"
        hint="Funds confirmed held by the escrow partner"
      />
      <StatCard
        label="Pending Deposit"
        value={d.pendingDeposit}
        icon={Clock}
        tone="amber"
        hint="Awaiting funding confirmation"
      />
      <StatCard
        label="Under Dispute"
        value={d.underDispute}
        icon={AlertTriangle}
        tone="red"
        hint="Release blocked pending case review"
      />
      <StatCard
        label="Total Value"
        value={formatCurrency(d.totalValue, d.currency)}
        icon={Wallet}
        tone="blue"
        hint="Aggregate escrow account value"
      />
    </div>
  );
}

export default StatusSummaryCards;

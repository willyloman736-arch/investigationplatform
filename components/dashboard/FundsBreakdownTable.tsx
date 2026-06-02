// ─────────────────────────────────────────────────────────────────────────────
// FundsBreakdownTable — escrow ledger summary table.
//
// Pure presentational (no client interactivity). Renders one row per case with
// the full fee/escrow breakdown. The table is wrapped in an overflow-x-auto
// container so wide content scrolls inside the card instead of overflowing the
// page on mobile.
// ─────────────────────────────────────────────────────────────────────────────

import { Wallet } from "lucide-react";

import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { DEPOSIT_STATUS_LABELS, RELEASE_STATUS_LABELS } from "@/lib/constants";
import type { FundsBreakdownRow } from "@/lib/types";

import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface FundsBreakdownTableProps {
  rows: FundsBreakdownRow[];
  className?: string;
  /** Optional caption rendered below the table. */
  caption?: string;
}

export function FundsBreakdownTable({
  rows,
  className,
  caption,
}: FundsBreakdownTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-card/60 px-6 py-12 text-center backdrop-blur-md",
          className
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-muted-foreground">
          <Wallet className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          No escrow contracts yet
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          When a case is funded, its fee breakdown and escrow status will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md",
        className
      )}
    >
      {/* Horizontal scroll lives inside the card so the page never overflows. */}
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[1040px]">
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="whitespace-nowrap">Case ID</TableHead>
              <TableHead className="whitespace-nowrap">Client</TableHead>
              <TableHead className="whitespace-nowrap">Counterparty</TableHead>
              <TableHead className="whitespace-nowrap text-right">Total</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Platform Fee
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Provider Fee
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Net Release
              </TableHead>
              <TableHead className="whitespace-nowrap">Deposit</TableHead>
              <TableHead className="whitespace-nowrap">Escrow Status</TableHead>
              <TableHead className="whitespace-nowrap">Release</TableHead>
              <TableHead className="whitespace-nowrap">Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.caseId} className="border-white/5">
                <TableCell className="whitespace-nowrap font-mono text-xs font-medium text-foreground">
                  {row.caseNumber}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground">
                  {row.client}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground">
                  {row.counterparty}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                  {formatCurrency(row.total, row.currency)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                  {formatCurrency(row.platformFee, row.currency)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                  {formatCurrency(row.providerFee, row.currency)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-cyan-300">
                  {formatCurrency(row.netRelease, row.currency)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {DEPOSIT_STATUS_LABELS[row.depositStatus]}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <EscrowStatusBadge status={row.escrowStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {RELEASE_STATUS_LABELS[row.releaseStatus]}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(row.lastUpdated)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {caption && (
        <p className="border-t border-white/10 px-4 py-2.5 text-[11px] text-muted-foreground">
          {caption}
        </p>
      )}
    </div>
  );
}

export default FundsBreakdownTable;

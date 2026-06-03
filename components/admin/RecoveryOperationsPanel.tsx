import Link from "next/link";
import {
  ArrowRight,
  FileCheck2,
  IdCard,
  ReceiptText,
  Wallet,
} from "lucide-react";

import {
  KYC_STATUS_LABELS,
  PAYOUT_METHOD_LABELS,
  RECOVERY_STAGE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type {
  KycStatus,
  RecoveryCaseStage,
  RecoveryOperationsCase,
  WithdrawalStatus,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/shared/StatCard";
import { SectionHeading } from "@/components/shared/SectionHeading";

interface RecoveryOperationsPanelProps {
  operations: RecoveryOperationsCase[];
}

const STAGE_CLASS: Record<RecoveryCaseStage, string> = {
  complaint_submitted: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  admin_review: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  more_evidence_needed: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  recovery_in_progress: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  funds_recovered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  escrow_funded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  withdrawal_review: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  paid_out: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

const KYC_VARIANT: Record<KycStatus, "secondary" | "warning" | "success" | "destructive"> = {
  not_started: "secondary",
  in_review: "warning",
  verified: "success",
  rejected: "destructive",
};

const WITHDRAWAL_VARIANT: Record<
  WithdrawalStatus,
  "secondary" | "warning" | "success" | "destructive" | "info"
> = {
  not_requested: "secondary",
  conditions_required: "warning",
  requested: "info",
  approved: "success",
  denied: "destructive",
  paid_out: "success",
};

function clientLabel(operation: RecoveryOperationsCase): string {
  const partyA = operation.parties?.find((p) => p.party_role === "party_a");
  return partyA?.invited_email ?? "Client";
}

export function RecoveryOperationsPanel({
  operations,
}: RecoveryOperationsPanelProps) {
  const totalRecovered = operations.reduce(
    (sum, item) => sum + item.recovered_amount,
    0
  );
  const kycInReview = operations.filter(
    (item) => item.kyc?.status === "in_review"
  ).length;
  const withdrawalQueue = operations.filter((item) =>
    ["conditions_required", "requested", "approved"].includes(
      item.withdrawal_request?.status ?? ""
    )
  ).length;
  const receiptCount = operations.reduce(
    (sum, item) => sum + item.receipts.length,
    0
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          title="Recovery operations"
          subtitle="KYC review, recovered balances, withdrawal approvals, receipt generation, and client email updates."
        />
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/cases">
            Open case roster
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Recovered Balance"
          value={formatCurrency(totalRecovered, "USD")}
          icon={Wallet}
          hint="Visible in client escrow accounts"
        />
        <StatCard
          label="KYC In Review"
          value={kycInReview}
          icon={IdCard}
          hint="Government ID, selfie, address, phone, email"
        />
        <StatCard
          label="Withdrawal Queue"
          value={withdrawalQueue}
          icon={FileCheck2}
          hint="Admin-controlled payout approvals"
        />
        <StatCard
          label="Receipts"
          value={receiptCount}
          icon={ReceiptText}
          hint="Downloadable PDF records"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="whitespace-nowrap">Case</TableHead>
                <TableHead className="whitespace-nowrap">Client</TableHead>
                <TableHead className="whitespace-nowrap">Stage</TableHead>
                <TableHead className="whitespace-nowrap">KYC</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Escrow balance
                </TableHead>
                <TableHead className="whitespace-nowrap">Withdrawal</TableHead>
                <TableHead className="whitespace-nowrap">Receipts</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.map((operation) => {
                const withdrawal = operation.withdrawal_request;
                const kycStatus = operation.kyc?.status ?? "not_started";
                return (
                  <TableRow key={operation.id} className="border-white/5">
                    <TableCell className="max-w-[260px]">
                      <span className="block font-mono text-xs text-muted-foreground">
                        {operation.case_number}
                      </span>
                      <span className="block truncate font-medium text-foreground">
                        {operation.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Updated {formatDate(operation.updated_at)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {clientLabel(operation)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          STAGE_CLASS[operation.recovery_stage]
                        )}
                      >
                        {RECOVERY_STAGE_LABELS[operation.recovery_stage]}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={KYC_VARIANT[kycStatus]}>
                        {KYC_STATUS_LABELS[kycStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                      {formatCurrency(
                        operation.escrow_available_amount,
                        operation.escrow?.currency ?? "USD"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {withdrawal ? (
                        <div className="space-y-1">
                          <Badge
                            variant={WITHDRAWAL_VARIANT[withdrawal.status]}
                          >
                            {WITHDRAWAL_STATUS_LABELS[withdrawal.status]}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground">
                            {PAYOUT_METHOD_LABELS[withdrawal.method]}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="secondary">Not Requested</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {operation.receipts.length}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/cases/${operation.id}`}>
                          Review
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

export default RecoveryOperationsPanel;

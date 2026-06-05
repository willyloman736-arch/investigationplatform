import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  Filter,
  IdCard,
  ReceiptText,
  Search,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  KYC_STATUS_LABELS,
  PAYOUT_METHOD_LABELS,
  RECOVERY_STAGE_LABELS,
  WITHDRAWAL_STATUS_BADGE_VARIANTS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type {
  KycStatus,
  RecoveryCaseStage,
  RecoveryOperationsCase,
  WithdrawalStatus,
} from "@/lib/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon3D } from "@/components/shared/Icon3D";

interface RecoveryOperationsPanelProps {
  operations: RecoveryOperationsCase[];
}

const STAGE_CLASS: Record<RecoveryCaseStage, string> = {
  complaint_submitted: "border-blue-400/25 bg-blue-400/10 text-blue-200",
  admin_review: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  accepted: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  rejected: "border-red-400/30 bg-red-400/10 text-red-200",
  more_evidence_needed:
    "border-orange-400/30 bg-orange-400/10 text-orange-200",
  recovery_in_progress: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  funds_recovered: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  escrow_funded: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  withdrawal_review: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  paid_out: "border-slate-400/25 bg-slate-400/10 text-slate-200",
};

const KYC_VARIANT: Record<
  KycStatus,
  "secondary" | "warning" | "success" | "destructive"
> = {
  not_started: "secondary",
  in_review: "warning",
  pending_review: "warning",
  verified: "success",
  rejected: "destructive",
  declined: "destructive",
  resubmission_required: "warning",
};

const WITHDRAWAL_VARIANT = WITHDRAWAL_STATUS_BADGE_VARIANTS;

type ActionTone = "urgent" | "warning" | "ready" | "complete" | "neutral";

const ACTION_TONE: Record<ActionTone, string> = {
  urgent: "border-red-400/30 bg-red-400/10 text-red-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  ready: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  complete: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  neutral: "border-blue-400/25 bg-blue-400/10 text-blue-200",
};

function clientLabel(operation: RecoveryOperationsCase): string {
  const partyA = operation.parties?.find((p) => p.party_role === "party_a");
  return partyA?.invited_email ?? "Client";
}

function nextAction(operation: RecoveryOperationsCase): {
  label: string;
  hint: string;
  tone: ActionTone;
  icon: LucideIcon;
} {
  const withdrawal = operation.withdrawal_request;
  const kycStatus = operation.kyc?.status ?? "not_started";

  if (operation.recovery_stage === "paid_out") {
    return {
      label: "Archive record",
      hint: "Payout complete",
      tone: "complete",
      icon: CheckCircle2,
    };
  }
  if (operation.recovery_stage === "more_evidence_needed") {
    return {
      label: "Request evidence",
      hint: "Client response needed",
      tone: "urgent",
      icon: ShieldAlert,
    };
  }
  if (kycStatus !== "verified") {
    return {
      label: "Review KYC",
      hint: KYC_STATUS_LABELS[kycStatus],
      tone: "warning",
      icon: IdCard,
    };
  }
  if (withdrawal?.status === "conditions_required") {
    return {
      label: "Clear conditions",
      hint: "Before payout approval",
      tone: "warning",
      icon: FileCheck2,
    };
  }
  if (withdrawal?.status === "requested") {
    return {
      label: "Approve withdrawal",
      hint: PAYOUT_METHOD_LABELS[withdrawal.method],
      tone: "neutral",
      icon: CreditCard,
    };
  }
  if (withdrawal?.status === "approved") {
    return {
      label: "Confirm payout",
      hint: "Provider/internal confirmation",
      tone: "ready",
      icon: CheckCircle2,
    };
  }
  return {
    label: "Monitor case",
    hint: RECOVERY_STAGE_LABELS[operation.recovery_stage],
    tone: "neutral",
    icon: Clock,
  };
}

export function RecoveryOperationsPanel({
  operations,
}: RecoveryOperationsPanelProps) {
  const totalRecovered = operations.reduce(
    (sum, item) => sum + item.recovered_amount,
    0
  );
  const kycInReview = operations.filter(
    (item) =>
      item.kyc?.status === "in_review" || item.kyc?.status === "pending_review"
  ).length;
  const withdrawalQueue = operations.filter((item) =>
    ["conditions_required", "requested", "approved"].includes(
      item.withdrawal_request?.status ?? ""
    )
  ).length;
  const evidenceNeeded = operations.filter(
    (item) => item.recovery_stage === "more_evidence_needed"
  ).length;
  const receiptCount = operations.reduce(
    (sum, item) => sum + item.receipts.length,
    0
  );
  const priorityQueue = operations
    .map((operation) => ({ operation, action: nextAction(operation) }))
    .filter(({ action }) => action.tone !== "complete")
    .slice(0, 4);

  return (
    <section id="recovery-operations" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            Operations board
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Recovery operations
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            KYC review, recovered balances, withdrawal approvals, receipts, and
            client updates organized into actionable admin queues.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/cases">
              Open case roster
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label="Recovered balance"
          value={formatCurrency(totalRecovered, "USD")}
          hint="Visible in client escrow"
          icon={Wallet}
          accent="emerald"
        />
        <MetricTile
          label="KYC review"
          value={kycInReview}
          hint="Identity checks pending"
          icon={IdCard}
          accent="blue"
          id="kyc-review"
        />
        <MetricTile
          label="Withdrawal queue"
          value={withdrawalQueue}
          hint="Admin payout actions"
          icon={CreditCard}
          accent="cyan"
          id="withdrawals"
        />
        <MetricTile
          label="Evidence needed"
          value={evidenceNeeded}
          hint="Waiting on client files"
          icon={ShieldAlert}
          accent="amber"
        />
        <MetricTile
          label="Receipts"
          value={receiptCount}
          hint="Downloadable PDF records"
          icon={ReceiptText}
          accent="violet"
          id="receipts"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Case queue
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sorted by most recent admin activity.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-background/45 px-3 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                Search-ready
              </span>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-background/45 px-3 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Queue filters
              </span>
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(220px,1.25fr)_minmax(150px,.72fr)_minmax(170px,.8fr)_minmax(130px,.65fr)_minmax(170px,.82fr)_110px] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:grid">
            <span>Case</span>
            <span>Client</span>
            <span>Stage</span>
            <span>KYC</span>
            <span>Withdrawal</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-white/8">
            {operations.map((operation) => (
              <QueueRow key={operation.id} operation={operation} />
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Next actions
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Highest-signal admin work.
                </p>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {priorityQueue.length}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {priorityQueue.map(({ operation, action }) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={operation.id}
                    href={`/admin/cases/${operation.id}`}
                    className="group block rounded-xl border border-white/10 bg-background/40 p-3 transition-colors hover:border-primary/35 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                          ACTION_TONE[action.tone]
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {action.label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {operation.case_number} · {action.hint}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/[0.08] p-4 backdrop-blur-xl">
            <p className="text-sm font-semibold text-foreground">
              Secure money movement rule
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Admins can mark eligibility, request confirmation, and generate
              records. Browser-side controls never move funds.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  id,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  accent: "emerald" | "blue" | "cyan" | "amber" | "violet";
  id?: string;
}) {
  return (
    <div
      id={id}
      className="group relative min-h-[150px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/15 backdrop-blur-xl transition-colors hover:border-white/20"
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <Icon3D icon={Icon} tone={accent} size={44} />
      </div>
      <p className="mt-7 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-sm leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

function QueueRow({ operation }: { operation: RecoveryOperationsCase }) {
  const withdrawal = operation.withdrawal_request;
  const kycStatus = operation.kyc?.status ?? "not_started";
  const action = nextAction(operation);
  const ActionIcon = action.icon;

  return (
    <div className="grid gap-3 px-4 py-4 transition-colors hover:bg-white/[0.035] sm:px-5 lg:grid-cols-[minmax(220px,1.25fr)_minmax(150px,.72fr)_minmax(170px,.8fr)_minmax(130px,.65fr)_minmax(170px,.82fr)_110px] lg:items-center lg:gap-4">
      <div className="min-w-0">
        <p className="font-mono text-xs text-muted-foreground">
          {operation.case_number}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground sm:text-base">
          {operation.title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Updated {formatDate(operation.updated_at)}
        </p>
      </div>

      <div className="min-w-0 text-sm text-muted-foreground">
        <span className="lg:hidden">Client: </span>
        <span className="truncate">{clientLabel(operation)}</span>
      </div>

      <div>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
            STAGE_CLASS[operation.recovery_stage]
          )}
        >
          {RECOVERY_STAGE_LABELS[operation.recovery_stage]}
        </span>
      </div>

      <div>
        <Badge variant={KYC_VARIANT[kycStatus]}>
          {KYC_STATUS_LABELS[kycStatus]}
        </Badge>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(
            operation.escrow_available_amount,
            operation.escrow?.currency ?? "USD"
          )}
        </p>
        {withdrawal ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={WITHDRAWAL_VARIANT[withdrawal.status]}>
              {WITHDRAWAL_STATUS_LABELS[withdrawal.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {PAYOUT_METHOD_LABELS[withdrawal.method]}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No request</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 lg:justify-end">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold lg:hidden",
            ACTION_TONE[action.tone]
          )}
        >
          <ActionIcon className="h-3.5 w-3.5" />
          {action.label}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/cases/${operation.id}`}>
            Review
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default RecoveryOperationsPanel;

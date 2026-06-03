import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderKanban,
  IdCard,
  Lock,
  MessageSquare,
  ReceiptText,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  DEMO_MODE,
  ESCROW_STATUS_CONFIG,
  KYC_STATUS_LABELS,
  PROVIDER_DISCLAIMER,
  RECOVERY_STAGE_LABELS,
  RELEASE_STATUS_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import {
  getApprovals,
  getAuditLogs,
  getCasesForUser,
  getCurrentUserMock,
  getDisputes,
  getEscrow,
  getFundsBreakdownRows,
  getProfileById,
  getRecoveryOperationsCases,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type {
  Approval,
  AuditLog,
  Dispute,
  EscrowContract,
  EscrowStatus,
  KycStatus,
  Profile,
  RecoveryOperationsCase,
  RecoveryReceipt,
  UserRole,
  WithdrawalCondition,
  WithdrawalStatus,
} from "@/lib/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuditLogTimeline } from "@/components/shared/AuditLogTimeline";
import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";
import { PayoutMethodStrip } from "@/components/shared/PayoutMethodStrip";
import { FundsBreakdownTable } from "@/components/dashboard/FundsBreakdownTable";
import { Sparkline } from "@/components/dashboard/Sparkline";

type EscrowTone = {
  accent: string;
  border: string;
  bg: string;
  chip: string;
  glow: string;
  ring: string;
  text: string;
};

const ESCROW_TONE: Record<EscrowStatus, EscrowTone> = {
  pending_deposit: {
    accent: "#f59e0b",
    border: "border-amber-400/25",
    bg: "bg-amber-400/[0.08]",
    chip: "bg-amber-400/15 text-amber-200 ring-amber-400/25",
    glow: "bg-amber-400/20",
    ring: "#f59e0b",
    text: "text-amber-200",
  },
  securely_escrowed: {
    accent: "#22c55e",
    border: "border-emerald-400/25",
    bg: "bg-emerald-400/[0.08]",
    chip: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    glow: "bg-emerald-400/20",
    ring: "#22c55e",
    text: "text-emerald-200",
  },
  under_dispute_audit: {
    accent: "#f43f5e",
    border: "border-rose-400/25",
    bg: "bg-rose-400/[0.08]",
    chip: "bg-rose-400/15 text-rose-200 ring-rose-400/25",
    glow: "bg-rose-400/20",
    ring: "#f43f5e",
    text: "text-rose-200",
  },
  ready_for_release: {
    accent: "#3b82f6",
    border: "border-blue-400/25",
    bg: "bg-blue-400/[0.08]",
    chip: "bg-blue-400/15 text-blue-200 ring-blue-400/25",
    glow: "bg-blue-400/20",
    ring: "#3b82f6",
    text: "text-blue-200",
  },
  release_frozen: {
    accent: "#fb923c",
    border: "border-orange-400/25",
    bg: "bg-orange-400/[0.08]",
    chip: "bg-orange-400/15 text-orange-200 ring-orange-400/25",
    glow: "bg-orange-400/20",
    ring: "#fb923c",
    text: "text-orange-200",
  },
  released: {
    accent: "#94a3b8",
    border: "border-slate-400/25",
    bg: "bg-slate-400/[0.08]",
    chip: "bg-slate-400/15 text-slate-200 ring-slate-400/25",
    glow: "bg-slate-400/15",
    ring: "#94a3b8",
    text: "text-slate-200",
  },
};

const TREND_SHAPE = [
  0.57, 0.58, 0.62, 0.6, 0.68, 0.72, 0.7, 0.79, 0.84, 0.81, 0.9, 0.94, 1,
];

const ESCROW_STEPS = [
  "Created",
  "Deposit",
  "Escrowed",
  "Review",
  "Approval",
  "Release",
];

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

async function resolveUser(): Promise<{
  id?: string;
  role: UserRole;
  name: string;
}> {
  if (DEMO_MODE) {
    const mock = await getCurrentUserMock("client");
    return { id: mock.id, role: mock.role, name: mock.full_name ?? mock.email };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: "client", name: "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return {
    id: profile?.id ?? user.id,
    role: profile?.role ?? "client",
    name: profile?.full_name ?? profile?.email ?? "",
  };
}

export default async function DashboardOverviewPage() {
  const user = await resolveUser();
  const cases = await getCasesForUser(user.role, user.id);
  const caseIds = new Set(cases.map((c) => c.id));

  const [operations, escrows, rows, audit, disputes, approvalsByCase] =
    await Promise.all([
      getRecoveryOperationsCases(user.role, user.id),
      Promise.all(cases.map((c) => getEscrow(c.id))),
      getFundsBreakdownRows(user.role, user.id),
      getAuditLogs(),
      getDisputes(),
      Promise.all(cases.map((c) => getApprovals(c.id))),
    ]);

  const escrowsOnly = escrows.filter((e): e is EscrowContract => Boolean(e));
  const allApprovals = approvalsByCase.flat();
  const openDisputes = disputes.filter(
    (d: Dispute) =>
      caseIds.has(d.case_id) &&
      (d.status === "open" || d.status === "under_review")
  );
  const recentActivity: AuditLog[] = audit
    .filter((log) => (log.case_id ? caseIds.has(log.case_id) : false))
    .slice(0, 8);

  const actorIds = Array.from(
    new Set(recentActivity.map((a) => a.actor_id).filter((x): x is string => !!x))
  );
  const actorProfiles = await Promise.all(actorIds.map((id) => getProfileById(id)));
  const actorNames = new Map<string, string>();
  actorProfiles.forEach((p, i) => {
    if (p) actorNames.set(actorIds[i], p.full_name ?? p.company ?? p.email);
  });
  const resolveActor = (id: string | null) =>
    id ? actorNames.get(id) : undefined;

  const primaryOperation =
    operations.find(
      (operation) =>
        operation.escrow_available_amount > 0 &&
        operation.escrow?.escrow_status !== "released"
    ) ??
    operations.find((operation) => operation.escrow) ??
    operations[0] ??
    null;

  if (!primaryOperation || operations.length === 0) {
    return <EmptyEscrowDashboard firstName={firstName(user.name)} />;
  }

  const currency =
    primaryOperation.escrow?.currency ?? escrowsOnly[0]?.currency ?? "USD";
  const visibleBalance = operations.reduce(
    (sum, operation) => sum + operation.escrow_available_amount,
    0
  );
  const activeEscrows = operations.filter(
    (operation) => operation.escrow && operation.escrow.escrow_status !== "released"
  );
  const pendingApprovals = allApprovals.filter((approval) => !approval.approved)
    .length;
  const underReviewCount = operations.filter((operation) => {
    const kycStatus = operation.kyc?.status ?? "not_started";
    return (
      kycStatus === "in_review" ||
      operation.recovery_stage === "admin_review" ||
      operation.recovery_stage === "more_evidence_needed" ||
      operation.recovery_stage === "withdrawal_review" ||
      operation.escrow?.escrow_status === "release_frozen"
    );
  }).length;
  const receipts = operations
    .flatMap((operation) => operation.receipts)
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
  const netEligibleWithdrawal = escrowsOnly
    .filter((escrow) => escrow.release_status === "eligible")
    .reduce((sum, escrow) => sum + escrow.net_release_amount, 0);
  const trend = TREND_SHAPE.map((factor) => Math.round(visibleBalance * factor));
  const primaryApprovals =
    approvalsByCase[cases.findIndex((c) => c.id === primaryOperation.id)] ?? [];
  const first = firstName(user.name);

  return (
    <div className="space-y-4 sm:space-y-6">
      <EscrowHero
        firstName={first}
        operations={operations}
        primaryOperation={primaryOperation}
        balance={visibleBalance}
        currency={currency}
        trend={trend}
        activeEscrows={activeEscrows.length}
        pendingApprovals={pendingApprovals}
        underReviewCount={underReviewCount}
        openDisputes={openDisputes.length}
        netEligibleWithdrawal={netEligibleWithdrawal}
      />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <EscrowAccountsBoard operations={operations} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ApprovalPreview
              operation={primaryOperation}
              approvals={primaryApprovals}
            />
            <WithdrawalReadiness operation={primaryOperation} />
          </div>
        </div>

        <aside className="space-y-5">
          <EscrowDetailsCard operation={primaryOperation} />
          <ReceiptsPanel receipts={receipts} />
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Escrow ledger"
            title="Detailed account breakdown"
            subtitle="Display-only balances, provider status, fees, and release state across your escrow accounts."
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/cases">
                  Open recovery files
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            }
          />
          <FundsBreakdownTable
            rows={rows}
            className="bg-white/[0.055] shadow-2xl shadow-black/20 backdrop-blur-xl"
            caption={`Amounts shown here are display-only. ${PROVIDER_DISCLAIMER}`}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Activity
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                Recent updates
              </h2>
            </div>
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <AuditLogTimeline items={recentActivity} resolveActor={resolveActor} />
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 text-xs leading-relaxed text-muted-foreground backdrop-blur-xl">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Your dashboard shows escrow workflow state only. Withdrawal requests,
          releases, and payout confirmations are controlled by admins and
          protected server-side provider workflows.
        </span>
      </p>
    </div>
  );
}

function EscrowHero({
  firstName,
  operations,
  primaryOperation,
  balance,
  currency,
  trend,
  activeEscrows,
  pendingApprovals,
  underReviewCount,
  openDisputes,
  netEligibleWithdrawal,
}: {
  firstName: string;
  operations: RecoveryOperationsCase[];
  primaryOperation: RecoveryOperationsCase;
  balance: number;
  currency: string;
  trend: number[];
  activeEscrows: number;
  pendingApprovals: number;
  underReviewCount: number;
  openDisputes: number;
  netEligibleWithdrawal: number;
}) {
  const escrowStatus = primaryOperation.escrow?.escrow_status ?? "pending_deposit";
  const tone = ESCROW_TONE[escrowStatus];

  return (
    <section className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.72fr)]">
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.5rem] border bg-white/[0.055] p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:rounded-3xl sm:p-6",
          tone.border
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full blur-3xl",
            tone.glow
          )}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure escrow account
              </span>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", tone.chip)}>
                {ESCROW_STATUS_CONFIG[escrowStatus].label}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Good morning,</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {firstName}
            </h1>
            <p className="mt-3 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block sm:text-base">
              Monitor recovered funds, KYC, withdrawal readiness, receipts, and
              dispute status from your client escrow dashboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/cases/${primaryOperation.id}`}>
                <Eye className="h-4 w-4" />
                View account
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/cases">
                <FolderKanban className="h-4 w-4" />
                Recovery files
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-1 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-white/10 bg-background/35 p-3 backdrop-blur-xl sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total escrow balance
                </p>
                <p className="mt-2 break-words text-[2rem] font-semibold leading-none tracking-tight text-foreground sm:text-5xl">
                  {formatCurrency(balance, currency)}
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/25">
                <Wallet className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 sm:mt-5">
              <Sparkline data={trend} className="h-16 w-full sm:h-24" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Balance visibility is updated after admin/provider review.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <HeroMetric
              label="Active escrow"
              value={activeEscrows}
              hint={`${operations.length} total accounts`}
              icon={ShieldCheck}
              accent="emerald"
            />
            <HeroMetric
              label="Pending approvals"
              value={pendingApprovals}
              hint="Client/operator sign-off"
              icon={CheckCircle2}
              accent="amber"
            />
            <HeroMetric
              label="Under review"
              value={underReviewCount}
              hint="KYC or admin review"
              icon={IdCard}
              accent="blue"
            />
            <HeroMetric
              label="Disputes"
              value={openDisputes}
              hint="Release paused if active"
              icon={ShieldAlert}
              accent="rose"
            />
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-4 gap-2 sm:mt-5">
          <QuickAction
            href={`/dashboard/cases/${primaryOperation.id}`}
            label="Message"
            icon={MessageSquare}
          />
          <QuickAction
            href={`/dashboard/cases/${primaryOperation.id}`}
            label="Upload evidence"
            icon={UploadCloud}
          />
          <QuickAction
            href={`/dashboard/cases/${primaryOperation.id}`}
            label="Withdrawal review"
            icon={CreditCard}
          />
          <QuickAction
            href="/dashboard/cases"
            label="All escrow files"
            icon={Search}
          />
        </div>
      </div>

      <div className="grid gap-5">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Withdrawal window
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {formatCurrency(netEligibleWithdrawal, currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Net eligible after admin review.
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
              <CreditCard className="h-6 w-6" />
            </span>
          </div>
        </div>
        <EscrowDetailsCard operation={primaryOperation} compact />
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  accent: "emerald" | "amber" | "blue" | "rose";
}) {
  const accentClass = {
    emerald: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    amber: "bg-amber-400/15 text-amber-200 ring-amber-400/25",
    blue: "bg-blue-400/15 text-blue-200 ring-blue-400/25",
    rose: "bg-rose-400/15 text-rose-200 ring-rose-400/25",
  }[accent];

  return (
    <div className="min-h-[104px] rounded-2xl border border-white/10 bg-background/35 p-3 backdrop-blur-xl sm:min-h-[132px] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium leading-tight text-muted-foreground sm:text-sm">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:h-9 sm:w-9",
            accentClass
          )}
        >
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
        {hint}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-background/35 px-1.5 py-2 text-center text-[11px] font-semibold leading-tight text-foreground backdrop-blur-xl transition-colors hover:border-primary/35 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[82px] sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25 transition-transform group-hover:-translate-y-0.5 sm:h-10 sm:w-10">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </span>
      <span>{label}</span>
    </Link>
  );
}

function EscrowDetailsCard({
  operation,
  compact = false,
}: {
  operation: RecoveryOperationsCase;
  compact?: boolean;
}) {
  const escrow = operation.escrow;
  const status = escrow?.escrow_status ?? "pending_deposit";
  const tone = ESCROW_TONE[status];
  const step = getEscrowStep(operation);
  const progress = step.current / step.total;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:rounded-3xl sm:p-5",
        tone.border
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl",
          tone.glow
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Escrow details
          </p>
          <h2 className="mt-2 line-clamp-2 text-xl font-semibold text-foreground">
            {operation.case_number}
          </h2>
        </div>
        <EscrowStatusBadge status={status} />
      </div>

      <div className="relative mt-5 flex flex-col items-center">
        <div
          className="grid h-36 w-36 place-items-center rounded-full p-2.5 sm:h-44 sm:w-44 sm:p-3"
          style={{
            background: `conic-gradient(${tone.ring} ${Math.round(
              progress * 360
            )}deg, rgba(255,255,255,0.08) 0deg)`,
          }}
        >
          <div className="grid h-full w-full place-items-center rounded-full border border-white/10 bg-background/80 text-center backdrop-blur-xl">
            <div>
              <Clock className={cn("mx-auto h-6 w-6 sm:h-7 sm:w-7", tone.text)} />
              <p className={cn("mt-2 text-sm font-semibold uppercase", tone.text)}>
                {step.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Step {step.current} of {step.total}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-background/35 p-4">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {operation.title}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <DetailMetric
            label="Escrow value"
            value={formatCurrency(
              operation.escrow_available_amount,
              escrow?.currency ?? "USD"
            )}
          />
          <DetailMetric
            label="Net withdrawal"
            value={formatCurrency(escrow?.net_release_amount ?? 0, escrow?.currency)}
          />
          {!compact ? (
            <>
              <DetailMetric
                label="Platform fee"
                value={formatCurrency(escrow?.platform_fee ?? 0, escrow?.currency)}
              />
              <DetailMetric
                label="Provider fee"
                value={formatCurrency(escrow?.provider_fee ?? 0, escrow?.currency)}
              />
            </>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <div className="relative mt-5">
          <ProgressTimeline operation={operation} />
        </div>
      ) : (
        <div className="relative mt-4">
          <SegmentProgress current={step.current} total={step.total} tone={tone} />
        </div>
      )}
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function ProgressTimeline({ operation }: { operation: RecoveryOperationsCase }) {
  const step = getEscrowStep(operation);
  const tone = ESCROW_TONE[operation.escrow?.escrow_status ?? "pending_deposit"];

  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
      <p className="text-sm font-semibold text-foreground">Progress timeline</p>
      <div className="mt-4 space-y-3">
        {ESCROW_STEPS.map((label, index) => {
          const active = index + 1 <= step.current;
          return (
            <div key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  active
                    ? `${tone.border} ${tone.bg} ${tone.text}`
                    : "border-white/10 bg-white/[0.035] text-muted-foreground"
                )}
              >
                {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EscrowAccountsBoard({
  operations,
}: {
  operations: RecoveryOperationsCase[];
}) {
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="My escrows"
        title="Escrow account status"
        subtitle="Every recovered-funds account connected to your complaint files."
        action={
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] p-1">
            <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              All
            </span>
            <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Active
            </span>
            <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {operations.map((operation) => (
          <EscrowAccountCard key={operation.id} operation={operation} />
        ))}
      </div>
    </section>
  );
}

function EscrowAccountCard({
  operation,
}: {
  operation: RecoveryOperationsCase;
}) {
  const escrowStatus = operation.escrow?.escrow_status ?? "pending_deposit";
  const tone = ESCROW_TONE[escrowStatus];
  const step = getEscrowStep(operation);
  const withdrawalStatus =
    operation.withdrawal_request?.status ?? "not_requested";

  return (
    <Link
      href={`/dashboard/cases/${operation.id}`}
      className={cn(
        "group block rounded-2xl border bg-white/[0.055] p-4 shadow-xl shadow-black/10 backdrop-blur-xl transition-colors hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {operation.case_number}
          </p>
          <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">
            {operation.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {formatDate(operation.updated_at)}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", tone.chip)}>
          {ESCROW_STATUS_CONFIG[escrowStatus].label}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Available escrow</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(
              operation.escrow_available_amount,
              operation.escrow?.currency ?? "USD"
            )}
          </p>
        </div>
        <Badge variant={WITHDRAWAL_VARIANT[withdrawalStatus]}>
          {WITHDRAWAL_STATUS_LABELS[withdrawalStatus]}
        </Badge>
      </div>

      <div className="mt-4">
        <SegmentProgress current={step.current} total={step.total} tone={tone} />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={tone.text}>Step {step.current} of {step.total}</span>
          <span className="text-muted-foreground">{step.label}</span>
        </div>
      </div>
    </Link>
  );
}

function SegmentProgress({
  current,
  total,
  tone,
}: {
  current: number;
  total: number;
  tone: EscrowTone;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className="h-1.5 rounded-full"
          style={{
            backgroundColor:
              index + 1 <= current ? tone.accent : "rgba(255,255,255,0.09)",
          }}
        />
      ))}
    </div>
  );
}

function ApprovalPreview({
  operation,
  approvals,
}: {
  operation: RecoveryOperationsCase;
  approvals: Approval[];
}) {
  const partyA = approvals.find((approval) => approval.party_role === "party_a");
  const partyB = approvals.find((approval) => approval.party_role === "party_b");

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Approvals
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Release consent
          </h2>
        </div>
        <FileCheck2 className="h-5 w-5 text-primary" />
      </div>

      <div className="mt-4 space-y-3">
        <ApprovalRow
          label="Client"
          sublabel="Party A"
          approval={partyA}
          fallbackApproved={false}
        />
        <ApprovalRow
          label="Recovery operator"
          sublabel="Party B"
          approval={partyB}
          fallbackApproved={false}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="flex-1" size="sm">
          <Link href={`/dashboard/cases/${operation.id}`}>
            <CheckCircle2 className="h-4 w-4" />
            Open approval panel
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1" size="sm">
          <Link href={`/dashboard/cases/${operation.id}`}>
            <ShieldAlert className="h-4 w-4" />
            Dispute review
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ApprovalRow({
  label,
  sublabel,
  approval,
  fallbackApproved,
}: {
  label: string;
  sublabel: string;
  approval?: Approval;
  fallbackApproved: boolean;
}) {
  const approved = approval?.approved ?? fallbackApproved;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3",
        approved
          ? "border-emerald-400/25 bg-emerald-400/[0.08]"
          : "border-amber-400/25 bg-amber-400/[0.08]"
      )}
    >
      <span
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
          approved
            ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25"
            : "bg-amber-400/15 text-amber-200 ring-amber-400/25"
        )}
      >
        {approved ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <span
        className={cn(
          "text-xs font-semibold",
          approved ? "text-emerald-200" : "text-amber-200"
        )}
      >
        {approved ? "Approved" : "Pending"}
      </span>
    </div>
  );
}

function WithdrawalReadiness({
  operation,
}: {
  operation: RecoveryOperationsCase;
}) {
  const kycStatus = operation.kyc?.status ?? "not_started";
  const withdrawal = operation.withdrawal_request;
  const conditions = operation.withdrawal_conditions;
  const completedConditions = conditions.filter((condition) => condition.satisfied)
    .length;
  const allConditionsMet =
    conditions.length === 0 || completedConditions === conditions.length;
  const withdrawalReady =
    kycStatus === "verified" &&
    allConditionsMet &&
    (withdrawal?.status === "approved" ||
      operation.escrow?.release_status === "eligible");

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Withdrawal
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Readiness checklist
          </h2>
        </div>
        <CreditCard className="h-5 w-5 text-primary" />
      </div>

      <div className="mt-4 grid gap-2">
        <ReadinessRow
          label="KYC verification"
          value={KYC_STATUS_LABELS[kycStatus]}
          complete={kycStatus === "verified"}
        />
        <ReadinessRow
          label="Admin conditions"
          value={`${completedConditions}/${conditions.length} complete`}
          complete={allConditionsMet}
        />
        <ReadinessRow
          label="Withdrawal request"
          value={
            withdrawal
              ? WITHDRAWAL_STATUS_LABELS[withdrawal.status]
              : "Not Requested"
          }
          complete={Boolean(withdrawal && withdrawal.status !== "not_requested")}
        />
        <ReadinessRow
          label="Release eligibility"
          value={RELEASE_STATUS_LABELS[operation.escrow?.release_status ?? "not_started"]}
          complete={operation.escrow?.release_status === "eligible"}
        />
      </div>

      <PayoutMethodStrip className="mt-4" compact />

      {conditions.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-background/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Conditions
          </p>
          <div className="mt-3 space-y-2">
            {conditions.slice(0, 3).map((condition) => (
              <ConditionLine key={condition.id} condition={condition} />
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "mt-4 rounded-2xl border px-3 py-2 text-sm",
          withdrawalReady
            ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100"
            : "border-primary/20 bg-primary/[0.07] text-muted-foreground"
        )}
      >
        {withdrawalReady
          ? "Your withdrawal is eligible for admin/provider payout review."
          : "Admin approval is required before payout options become available."}
      </div>
    </section>
  );
}

function ReadinessRow({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/35 px-3 py-2">
      <span
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          complete
            ? "bg-emerald-400/15 text-emerald-200"
            : "bg-amber-400/15 text-amber-200"
        )}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {value}
        </span>
      </span>
    </div>
  );
}

function ConditionLine({ condition }: { condition: WithdrawalCondition }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          condition.satisfied
            ? "bg-emerald-400/15 text-emerald-200"
            : "bg-amber-400/15 text-amber-200"
        )}
      >
        {condition.satisfied ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground">
          {condition.label}
        </span>
        <span className="block line-clamp-2 text-muted-foreground">
          {condition.description}
        </span>
      </span>
    </div>
  );
}

function ReceiptsPanel({ receipts }: { receipts: RecoveryReceipt[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Receipts
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Download records
          </h2>
        </div>
        <ReceiptText className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 space-y-2">
        {receipts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-background/35 p-4 text-sm text-muted-foreground">
            No receipts are available yet.
          </p>
        ) : (
          receipts.slice(0, 4).map((receipt) => (
            <Link
              key={receipt.id}
              href={`/api/receipts/${receipt.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-background/35 p-3 transition-colors hover:border-primary/35 hover:bg-primary/10"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {receipt.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {receipt.receipt_number} - {formatDate(receipt.issued_at)}
                </span>
              </span>
              <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function EmptyEscrowDashboard({ firstName }: { firstName: string }) {
  return (
    <section className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.04] px-5 py-10 text-center backdrop-blur-xl sm:rounded-3xl sm:px-6 sm:py-16">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary sm:h-16 sm:w-16">
        <Wallet className="h-7 w-7 sm:h-8 sm:w-8" />
      </div>
      <p className="text-sm text-muted-foreground">Good morning, {firstName}</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">
        Escrow account pending
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Your recovery file and escrow account stay in separate dashboard areas.
        Once a case exists and admins enter recovered funds, the escrow account
        appears here.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/dashboard/cases">
            <FolderKanban className="h-4 w-4" />
            Open recovery cases
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/profile">
            <IdCard className="h-4 w-4" />
            Complete profile
          </Link>
        </Button>
      </div>
    </section>
  );
}

function getEscrowStep(operation: RecoveryOperationsCase): {
  current: number;
  total: number;
  label: string;
} {
  const status = operation.escrow?.escrow_status;
  const withdrawalStatus = operation.withdrawal_request?.status;

  if (status === "released" || withdrawalStatus === "paid_out") {
    return { current: 6, total: 6, label: "Released" };
  }
  if (
    status === "ready_for_release" ||
    operation.escrow?.release_status === "eligible" ||
    withdrawalStatus === "approved"
  ) {
    return { current: 5, total: 6, label: "Approval" };
  }
  if (
    status === "under_dispute_audit" ||
    status === "release_frozen" ||
    operation.recovery_stage === "withdrawal_review" ||
    withdrawalStatus === "requested" ||
    withdrawalStatus === "conditions_required"
  ) {
    return { current: 4, total: 6, label: "Review" };
  }
  if (
    status === "securely_escrowed" ||
    operation.recovery_stage === "escrow_funded" ||
    operation.recovery_stage === "funds_recovered"
  ) {
    return { current: 3, total: 6, label: "Escrowed" };
  }
  if (status === "pending_deposit") {
    return { current: 2, total: 6, label: "Deposit" };
  }
  return { current: 1, total: 6, label: RECOVERY_STAGE_LABELS[operation.recovery_stage] };
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || "there";
}

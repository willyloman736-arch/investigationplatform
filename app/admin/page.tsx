import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Flag,
  FolderKanban,
  Gavel,
  IdCard,
  Lock,
  ReceiptText,
  ScrollText,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { APP_NAME, PROVIDER_DISCLAIMER } from "@/lib/constants";
import {
  getAllCasesForAdmin,
  getEscrow,
  getDisputes,
  getAuditLogs,
  getFundsBreakdownRows,
  getStats,
  getProfileById,
  getRecoveryOperationsCases,
} from "@/lib/data";
import type {
  AuditLog,
  CaseWithRelations,
  Dispute,
  PlatformStats,
  Profile,
  RecoveryOperationsCase,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { AuditLogTimeline } from "@/components/shared/AuditLogTimeline";
import { FundsBreakdownTable } from "@/components/dashboard/FundsBreakdownTable";
import { StatusSummaryCards } from "@/components/dashboard/StatusSummaryCards";
import { RecoveryOperationsPanel } from "@/components/admin/RecoveryOperationsPanel";
import { Icon3D, type Icon3DTone } from "@/components/shared/Icon3D";

export const metadata = {
  title: `Command Center · ${APP_NAME}`,
};

async function getCasesWithEscrow(): Promise<CaseWithRelations[]> {
  const cases = await getAllCasesForAdmin();
  return Promise.all(
    cases.map(async (c) => ({
      ...c,
      escrow: await getEscrow(c.id),
    }))
  );
}

async function buildActorResolver(
  logs: AuditLog[]
): Promise<(id: string | null) => string | undefined> {
  const ids = Array.from(
    new Set(logs.map((l) => l.actor_id).filter((id): id is string => Boolean(id)))
  );
  const entries = await Promise.all(
    ids.map(async (id) => [id, await getProfileById(id)] as const)
  );
  const map = new Map<string, Profile | null>(entries);
  return (id: string | null) => {
    if (!id) return "System";
    const p = map.get(id);
    return p?.full_name ?? p?.company ?? p?.email ?? "Participant";
  };
}

export default async function AdminOverviewPage() {
  const [cases, fundsRows, disputes, auditLogs, stats] = await Promise.all([
    getCasesWithEscrow(),
    getFundsBreakdownRows("admin"),
    getDisputes(),
    getAuditLogs(),
    getStats(),
  ]);
  const recoveryOperations = await getRecoveryOperationsCases("admin");

  const openDisputes = disputes.filter(
    (d: Dispute) => d.status === "open" || d.status === "under_review"
  );
  const flaggedCount = auditLogs.filter((l) =>
    l.action.toLowerCase().includes("flag")
  ).length;
  const recentAudit = auditLogs.slice(0, 8);
  const resolveActor = await buildActorResolver(recentAudit);

  return (
    <div className="space-y-8">
      <CommandHero
        operations={recoveryOperations}
        openDisputes={openDisputes.length}
        flaggedCount={flaggedCount}
      />

      <RecoveryOperationsPanel operations={recoveryOperations} />

      <PlatformPulse
        cases={cases}
        stats={stats}
        openDisputes={openDisputes.length}
        flaggedCount={flaggedCount}
      />

      <section id="escrow-ledger" className="space-y-4 scroll-mt-24">
        <SectionHeader
          eyebrow="Escrow ledger"
          title="All recovery accounts"
          subtitle="Fee breakdown, recovered balances, provider status, and withdrawal posture across every client account."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/cases">
                View roster
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <FundsBreakdownTable
          rows={fundsRows}
          className="bg-white/[0.055] shadow-2xl shadow-black/20 backdrop-blur-xl"
          caption={`Showing ${fundsRows.length} escrow ${
            fundsRows.length === 1 ? "account" : "accounts"
          }. Amounts are display-only; payout movement stays protected server-side. ${PROVIDER_DISCLAIMER}`}
        />
      </section>

      <section id="audit-logs" className="grid grid-cols-1 gap-5 scroll-mt-24 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Audit activity
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Recent admin actions
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-background/45 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Last {recentAudit.length} events
            </span>
          </div>
          <AuditLogTimeline items={recentAudit} resolveActor={resolveActor} />
        </div>

        <CommandLinks openDisputes={openDisputes.length} />
      </section>
    </div>
  );
}

function CommandHero({
  operations,
  openDisputes,
  flaggedCount,
}: {
  operations: RecoveryOperationsCase[];
  openDisputes: number;
  flaggedCount: number;
}) {
  const recoveredTotal = operations.reduce(
    (sum, operation) => sum + operation.recovered_amount,
    0
  );
  const withdrawalQueue = operations.filter((operation) =>
    ["conditions_required", "requested", "approved"].includes(
      operation.withdrawal_request?.status ?? ""
    )
  ).length;
  const kycQueue = operations.filter(
    (operation) =>
      operation.kyc?.status === "in_review" ||
      operation.kyc?.status === "pending_review"
  ).length;

  const heroStats: {
    label: string;
    value: string | number;
    hint: string;
    icon: LucideIcon;
    tone: Icon3DTone;
  }[] = [
    {
      label: "Recovered funds",
      value: formatCurrency(recoveredTotal, "USD"),
      hint: "Loaded by admin",
      icon: Wallet,
      tone: "emerald",
    },
    {
      label: "KYC queue",
      value: kycQueue,
      hint: "Identity review",
      icon: IdCard,
      tone: "cyan",
    },
    {
      label: "Withdrawals",
      value: withdrawalQueue,
      hint: "Approval needed",
      icon: CreditCard,
      tone: "blue",
    },
    {
      label: "Disputes",
      value: openDisputes,
      hint: "Admin review",
      icon: ShieldAlert,
      tone: "red",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6 lg:p-7">
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
        aria-hidden="true"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <Activity className="h-3.5 w-3.5" />
            Command center
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Admin recovery command center
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Manage crypto scam complaints, recovered funds, escrow visibility,
            KYC verification, withdrawal conditions, receipts, disputes, and
            email-ready client updates from one premium operations surface.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/admin/cases">
                <FolderKanban className="h-4 w-4" />
                Manage cases
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/disputes">
                <ShieldAlert className="h-4 w-4" />
                Review disputes
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-background/35 p-4 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <Icon3D icon={Lock} tone="blue" size={40} className="shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                Workflow control, not frontend money movement
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Admins can mark balances, request evidence, approve withdrawal
                eligibility, and generate receipts. Real payout actions stay in
                protected server routes and require provider confirmation.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStatus label="Audit logged" value="Every action" />
            <MiniStatus
              label="Flagged events"
              value={String(flaggedCount)}
              tone={flaggedCount > 0 ? "warning" : "normal"}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {heroStats.map((stat) => (
          <HeroStat key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone: Icon3DTone;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon3D icon={Icon} tone={tone} size={40} />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function MiniStatus({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        tone === "warning"
          ? "border-amber-400/25 bg-amber-400/10"
          : "border-white/10 bg-white/[0.035]"
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PlatformPulse({
  cases,
  stats,
  openDisputes,
  flaggedCount,
}: {
  cases: CaseWithRelations[];
  stats: PlatformStats;
  openDisputes: number;
  flaggedCount: number;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Platform pulse"
        title="Escrow and risk posture"
        subtitle="A quick operating read on account funding, dispute load, and review exposure before admins act."
      />
      <StatusSummaryCards cases={cases} stats={stats} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PulseCard
          label="Total cases"
          value={cases.length}
          hint="Every recovery record"
          icon={FolderKanban}
          accent="blue"
        />
        <PulseCard
          label="Open disputes"
          value={openDisputes}
          hint="Awaiting resolution"
          icon={Gavel}
          accent="red"
          tone={openDisputes > 0 ? "warning" : "normal"}
        />
        <PulseCard
          label="Flagged events"
          value={flaggedCount}
          hint="Suspicious activity review"
          icon={Flag}
          accent="amber"
          tone={flaggedCount > 0 ? "warning" : "normal"}
        />
        <PulseCard
          label="Disputes resolved"
          value={stats.activeDisputesResolved}
          hint="Release or refund outcomes"
          icon={CheckCircle2}
          accent="emerald"
        />
      </div>
    </section>
  );
}

function PulseCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  tone = "normal",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  accent: Icon3DTone;
  tone?: "normal" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/[0.055] p-4 shadow-xl shadow-black/10 backdrop-blur-xl",
        tone === "warning" ? "border-amber-400/25" : "border-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon3D icon={Icon} tone={accent} size={40} />
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
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
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CommandLinks({ openDisputes }: { openDisputes: number }) {
  const links: {
    href: string;
    label: string;
    hint: string;
    icon: LucideIcon;
    tone: Icon3DTone;
  }[] = [
    {
      href: "/admin/cases",
      label: "Case roster",
      hint: "Create, review, assign, suspend, and close cases",
      icon: FolderKanban,
      tone: "blue",
    },
    {
      href: "/admin/withdrawals",
      label: "Withdrawal queue",
      hint: "Conditions, approvals, payout confirmation",
      icon: CreditCard,
      tone: "cyan",
    },
    {
      href: "/admin/kyc",
      label: "KYC review",
      hint: "Government ID, selfie, address, phone, email",
      icon: IdCard,
      tone: "violet",
    },
    {
      href: "/admin/disputes",
      label: "Disputes",
      hint:
        openDisputes > 0
          ? `${openDisputes} awaiting admin decision`
          : "No open disputes",
      icon: ShieldAlert,
      tone: "red",
    },
    {
      href: "/admin/cases",
      label: "Receipts",
      hint: "Generate and download client records",
      icon: ReceiptText,
      tone: "amber",
    },
    {
      href: "/admin#escrow-ledger",
      label: "Escrow ledger",
      hint: "Recovered balances and provider status",
      icon: ScrollText,
      tone: "emerald",
    },
    {
      href: "/admin#audit-logs",
      label: "Audit log",
      hint: "Reason notes and admin override history",
      icon: FileCheck2,
      tone: "slate",
    },
    {
      href: "/admin/cases",
      label: "Release eligibility",
      hint: "Admin-reviewed release readiness only",
      icon: BadgeCheck,
      tone: "blue",
    },
  ];

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Quick actions
          </p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">
            Admin shortcuts
          </h3>
        </div>
        <Icon3D icon={Wallet} tone="blue" size={40} />
      </div>
      <div className="mt-4 space-y-2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={`${l.href}-${l.label}`}
              href={l.href}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-background/40 px-3 py-3 transition-colors hover:border-primary/35 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon3D icon={Icon} tone={l.tone} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {l.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {l.hint}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

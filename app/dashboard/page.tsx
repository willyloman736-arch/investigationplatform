// ─────────────────────────────────────────────────────────────────────────────
// Client dashboard overview (Server Component) — a premium, crypto-style bento.
//
//   Row 1  Portfolio hero (total in escrow + trend) │ Escrow status donut
//   Row 2  KPI cards (escrowed value · ready · pending · dispute)
//   Row 3  Funds breakdown table │ Recent activity feed
//
// All data via @/lib/data (read-only; mutations live in server actions). Charts
// are dependency-free SVG; figures use tabular numerals; the trend is illustrative.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

import { DEMO_MODE, PROVIDER_DISCLAIMER, ESCROW_STATUS_CONFIG } from "@/lib/constants";
import {
  getAuditLogs,
  getCasesForUser,
  getCurrentUserMock,
  getEscrow,
  getFundsBreakdownRows,
  getProfileById,
  getStats,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type {
  AuditLog,
  CaseWithRelations,
  EscrowContract,
  EscrowStatus,
  Profile,
  UserRole,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { AuditLogTimeline } from "@/components/shared/AuditLogTimeline";
import { CaseSelector } from "@/components/dashboard/CaseSelector";
import { FundsBreakdownTable } from "@/components/dashboard/FundsBreakdownTable";
import { EscrowPortfolioCard } from "@/components/dashboard/EscrowPortfolioCard";
import {
  EscrowStatusDonut,
  type DonutSegment,
} from "@/components/dashboard/EscrowStatusDonut";
import { KpiCard } from "@/components/dashboard/KpiCard";

/** Chart/segment colors per escrow status (≥3:1 on the dark surface). */
const STATUS_HEX: Record<EscrowStatus, string> = {
  pending_deposit: "#fbbf24", // amber
  securely_escrowed: "#34d399", // green
  under_dispute_audit: "#f87171", // red
  ready_for_release: "#38bdf8", // sky / ice
  release_frozen: "#fb923c", // orange
  released: "#94a3b8", // slate
};

const STATUS_ORDER: EscrowStatus[] = [
  "securely_escrowed",
  "ready_for_release",
  "pending_deposit",
  "under_dispute_audit",
  "release_frozen",
  "released",
];

/** Illustrative rising trend shape (deterministic) scaled to the current total. */
const TREND_SHAPE = [
  0.58, 0.6, 0.59, 0.66, 0.69, 0.67, 0.74, 0.78, 0.76, 0.85, 0.9, 0.94, 0.97, 1,
];

/** Resolve the current user (DEMO-aware) so reads are scoped correctly. */
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
  const escrows = await Promise.all(cases.map((c) => getEscrow(c.id)));
  const casesWithEscrow: CaseWithRelations[] = cases.map((c, i) => ({
    ...c,
    escrow: escrows[i],
  }));

  const [stats, rows, audit] = await Promise.all([
    getStats(),
    getFundsBreakdownRows(user.role, user.id),
    getAuditLogs(),
  ]);

  // ── Portfolio + distribution math (from the user's real escrow contracts) ──
  const escrowsOnly = escrows.filter((e): e is EscrowContract => Boolean(e));
  const currency = escrowsOnly[0]?.currency ?? stats.currency ?? "USD";

  const totalInEscrow = escrowsOnly.reduce(
    (sum, e) => sum + (e.total_amount ?? 0),
    0
  );
  const netReleasable = escrowsOnly
    .filter((e) => e.release_status === "eligible")
    .reduce((sum, e) => sum + (e.net_release_amount ?? 0), 0);

  const countBy = (s: EscrowStatus) =>
    escrowsOnly.filter((e) => e.escrow_status === s).length;
  const valueBy = (s: EscrowStatus) =>
    escrowsOnly
      .filter((e) => e.escrow_status === s)
      .reduce((sum, e) => sum + (e.total_amount ?? 0), 0);

  const trend = TREND_SHAPE.map((f) => Math.round(totalInEscrow * f));

  const segments: DonutSegment[] = STATUS_ORDER.map((s) => ({
    label: ESCROW_STATUS_CONFIG[s].label,
    value: countBy(s),
    color: STATUS_HEX[s],
  })).filter((seg) => seg.value > 0);

  // ── Activity feed: scope to the user's cases, resolve actor names ──
  const caseIds = new Set(cases.map((c) => c.id));
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

  const firstName = user.name.split(/\s+/)[0] || "there";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Your escrow portfolio, contract status, and recent activity at a glance.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <CaseSelector cases={cases} />
        </div>
      </div>

      {/* Row 1 — Portfolio hero + status donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EscrowPortfolioCard
            total={totalInEscrow}
            currency={currency}
            trend={trend}
            netReleasable={netReleasable}
            activeContracts={escrowsOnly.length}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md sm:p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Escrow status
          </h2>
          <div className="mt-5">
            <EscrowStatusDonut
              segments={segments}
              centerValue={String(escrowsOnly.length)}
              centerLabel="Contracts"
            />
          </div>
        </div>
      </div>

      {/* Row 2 — KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={ShieldCheck}
          label="Securely escrowed"
          value={formatCurrency(valueBy("securely_escrowed"), currency)}
          hint={`${countBy("securely_escrowed")} contract${
            countBy("securely_escrowed") === 1 ? "" : "s"
          }`}
          accentClass="bg-emerald-500/12 text-emerald-300 ring-emerald-500/25"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Ready for release"
          value={String(countBy("ready_for_release"))}
          hint={`${formatCurrency(netReleasable, currency)} net`}
          accentClass="bg-sky-500/12 text-sky-300 ring-sky-500/25"
        />
        <KpiCard
          icon={Clock}
          label="Pending deposit"
          value={String(countBy("pending_deposit"))}
          hint="Awaiting funding"
          accentClass="bg-amber-500/12 text-amber-300 ring-amber-500/25"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Under dispute"
          value={String(countBy("under_dispute_audit"))}
          hint="Under audit"
          accentClass="bg-red-500/12 text-red-300 ring-red-500/25"
        />
      </div>

      {/* Row 3 — Funds breakdown + recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Your escrow contracts
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/cases">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <FundsBreakdownTable rows={rows} caption={PROVIDER_DISCLAIMER} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Recent activity
          </h2>
          <div className="rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md">
            <AuditLogTimeline items={recentActivity} resolveActor={resolveActor} />
          </div>
        </section>
      </div>

      {/* Honest trust footnote */}
      <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{PROVIDER_DISCLAIMER}</span>
      </p>
    </div>
  );
}

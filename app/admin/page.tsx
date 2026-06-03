// ─────────────────────────────────────────────────────────────────────────────
// Admin command center — operational overview of the whole platform.
//
// Server Component. Composes existing presentational components and reads from
// "@/lib/data" (mock data in DEMO; real Supabase queries are TODO-marked there).
//
// Surfaces platform-wide escrow posture, the full funds breakdown across ALL
// cases, the most recent audit activity, and quick links into management areas.
// Reinforces the compliance stance: the admin steers the workflow but never
// moves money directly.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import {
  ArrowRight,
  FolderKanban,
  ShieldAlert,
  ScrollText,
  Gavel,
  Flag,
  CheckCircle2,
  Wallet,
  Lock,
} from "lucide-react";

import { formatCurrency } from "@/lib/utils";
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
  Profile,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { StatCard } from "@/components/shared/StatCard";
import { StatusSummaryCards } from "@/components/dashboard/StatusSummaryCards";
import { FundsBreakdownTable } from "@/components/dashboard/FundsBreakdownTable";
import { AuditLogTimeline } from "@/components/shared/AuditLogTimeline";
import { RecoveryOperationsPanel } from "@/components/admin/RecoveryOperationsPanel";

export const metadata = {
  title: `Command Center · ${APP_NAME}`,
};

/** Build CaseWithRelations[] (cases + escrow) for the summary derivations. */
async function getCasesWithEscrow(): Promise<CaseWithRelations[]> {
  const cases = await getAllCasesForAdmin();
  return Promise.all(
    cases.map(async (c) => ({
      ...c,
      escrow: await getEscrow(c.id),
    }))
  );
}

/** Map actor ids → display names for the audit timeline (best-effort). */
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
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          as="h1"
          eyebrow="Command Center"
          title="Recovery operations overview"
          subtitle="Control crypto scam complaints, KYC review, recovered funds, escrow balances, withdrawal approvals, disputes, receipts, and audit activity from one admin command center."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/cases">
              <FolderKanban className="h-4 w-4" />
              Manage cases
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/disputes">
              <ShieldAlert className="h-4 w-4" />
              Review disputes
            </Link>
          </Button>
        </div>
      </div>

      {/* Compliance reminder */}
      <Alert className="border-primary/30 bg-primary/[0.06]">
        <Lock className="h-4 w-4" />
        <AlertTitle className="text-foreground">
          Administrators control workflow, not browser-side money movement
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Admins may enter recovered funds, mark escrow visibility, approve
          withdrawal eligibility, and generate records. Actual payout or release
          requests must run through protected server routes and provider
          confirmation. Every action is recorded in the audit log.{" "}
          {PROVIDER_DISCLAIMER}
        </AlertDescription>
      </Alert>

      <RecoveryOperationsPanel operations={recoveryOperations} />

      {/* Platform-wide escrow posture */}
      <section className="space-y-4">
        <StatusSummaryCards cases={cases} stats={stats} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Cases"
            value={cases.length}
            icon={FolderKanban}
            hint="All cases on the platform"
          />
          <StatCard
            label="Open Disputes"
            value={openDisputes.length}
            icon={Gavel}
            hint="Awaiting admin resolution"
          />
          <StatCard
            label="Flagged Events"
            value={flaggedCount}
            icon={Flag}
            hint="Activity flagged for review"
          />
          <StatCard
            label="Disputes Resolved"
            value={stats.activeDisputesResolved}
            icon={CheckCircle2}
            hint="Resolved to release or refund"
          />
        </div>
      </section>

      {/* Full funds breakdown across all cases */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading
            title="Escrow ledger - all cases"
            subtitle="Fee breakdown and live escrow status for every recovery account."
          />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/cases">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <FundsBreakdownTable
          rows={fundsRows}
          caption={`Showing ${fundsRows.length} escrow ${
            fundsRows.length === 1 ? "account" : "accounts"
          }. Amounts are display-only; payout movement stays protected server-side. ${PROVIDER_DISCLAIMER}`}
        />
      </section>

      {/* Recent activity + quick links */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-md sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <ScrollText className="h-4 w-4 text-primary" />
                Recent audit activity
              </h3>
              <span className="text-xs text-muted-foreground">
                Last {recentAudit.length} events
              </span>
            </div>
            <AuditLogTimeline items={recentAudit} resolveActor={resolveActor} />
          </div>
        </div>

        <aside className="space-y-4">
          <QuickLinks openDisputes={openDisputes.length} />
        </aside>
      </section>
    </div>
  );
}

function QuickLinks({ openDisputes }: { openDisputes: number }) {
  const links = [
    {
      href: "/admin/cases",
      label: "Cases",
      hint: "Create, assign, and manage",
      icon: FolderKanban,
    },
    {
      href: "/admin/disputes",
      label: "Disputes",
      hint:
        openDisputes > 0
          ? `${openDisputes} awaiting review`
          : "No open disputes",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-md sm:p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Wallet className="h-4 w-4 text-primary" />
        Quick links
      </h3>
      <div className="mt-4 space-y-2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {l.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {l.hint}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

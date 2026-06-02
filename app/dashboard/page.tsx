// ─────────────────────────────────────────────────────────────────────────────
// Client dashboard overview (Server Component).
//
// Composition (all data via @/lib/data — read-only; mutations live in actions):
//   • StatusSummaryCards  — derived from the user's cases + platform stats
//   • CaseSelector        — quick switcher into a case workspace
//   • FundsBreakdownTable — escrow/fee summary across the user's cases
//   • AuditLogTimeline    — recent activity across the user's cases
//
// Server Component fetches and passes plain data to the client components.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

import { DEMO_MODE, PROVIDER_DISCLAIMER } from "@/lib/constants";
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
import type {
  AuditLog,
  CaseWithRelations,
  Profile,
  UserRole,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { AuditLogTimeline } from "@/components/shared/AuditLogTimeline";
import { CaseSelector } from "@/components/dashboard/CaseSelector";
import { FundsBreakdownTable } from "@/components/dashboard/FundsBreakdownTable";
import { StatusSummaryCards } from "@/components/dashboard/StatusSummaryCards";

/** Resolve the current user (DEMO-aware) so reads are scoped correctly. */
async function resolveUser(): Promise<{ id?: string; role: UserRole; name: string }> {
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

  // Fetch the visible cases, then enrich with their escrow for the summary cards.
  const cases = await getCasesForUser(user.role, user.id);
  const escrows = await Promise.all(cases.map((c) => getEscrow(c.id)));
  const casesWithEscrow: CaseWithRelations[] = cases.map((c, i) => ({
    ...c,
    escrow: escrows[i],
  }));

  const [stats, rows, audit] = await Promise.all([
    getStats(),
    getFundsBreakdownRows(user.role, user.id),
    getAuditLogs(), // platform trail; filtered to the user's cases below
  ]);

  // Scope the activity feed to the user's cases and show the most recent slice.
  const caseIds = new Set(cases.map((c) => c.id));
  const recentActivity: AuditLog[] = audit
    .filter((log) => (log.case_id ? caseIds.has(log.case_id) : false))
    .slice(0, 8);

  // Build an actor-id → display-name resolver for the timeline.
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
    <div className="space-y-8">
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
            Track your escrow cases, evidence, and release status in one place.
          </p>
        </div>

        {/* Quick case switcher */}
        <div className="w-full sm:w-auto">
          <CaseSelector cases={cases} />
        </div>
      </div>

      {/* Summary KPIs */}
      <StatusSummaryCards cases={casesWithEscrow} stats={stats} />

      {/* Funds breakdown */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading
            title="Your escrow contracts"
            subtitle="Fee breakdown and live escrow status for every case you're a party to."
          />
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/cases">
              View all cases
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <FundsBreakdownTable
          rows={rows}
          caption={PROVIDER_DISCLAIMER}
        />
      </section>

      {/* Recent activity */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Audit trail"
          title="Recent activity"
          subtitle="Every important action on your cases is recorded for transparency and dispute review."
        />
        <div className="rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md sm:p-6">
          <AuditLogTimeline items={recentActivity} resolveActor={resolveActor} />
        </div>
      </section>

      {/* Honest trust footnote */}
      <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{PROVIDER_DISCLAIMER}</span>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Client cases list (Server Component).
//
// Lists every case the signed-in user is a party to as a responsive grid of
// glassmorphic cards. Each card links into the case workspace
// (/dashboard/cases/[caseId]) and surfaces the live escrow status, case status,
// counterparty, and headline amounts. Data via @/lib/data (read-only).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import {
  ArrowUpRight,
  FolderKanban,
  Tag,
  Users,
  Wallet,
} from "lucide-react";

import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { CASE_STATUS_CONFIG, DEMO_MODE } from "@/lib/constants";
import {
  getCaseParties,
  getCasesForUser,
  getCurrentUserMock,
  getEscrow,
  getProfileById,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type {
  Case,
  CaseParty,
  EscrowContract,
  Profile,
  UserRole,
} from "@/lib/types";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";

async function resolveUser(): Promise<{ id?: string; role: UserRole }> {
  if (DEMO_MODE) {
    const mock = await getCurrentUserMock("client");
    return { id: mock.id, role: mock.role };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: "client" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  return { id: profile?.id ?? user.id, role: profile?.role ?? "client" };
}

/** Resolve a display name for a case party (profile name/company, else email). */
async function partyDisplayName(party: CaseParty | undefined): Promise<string> {
  if (!party) return "—";
  if (party.profile_id) {
    const profile = await getProfileById(party.profile_id);
    if (profile) return profile.full_name ?? profile.company ?? profile.email;
  }
  return party.invited_email ?? "Invited";
}

interface CaseCardData {
  caseRow: Case;
  escrow: EscrowContract | null;
  partyA: string;
  partyB: string;
}

export default async function ClientCasesPage() {
  const user = await resolveUser();
  const cases = await getCasesForUser(user.role, user.id);

  // Enrich each case with escrow + party display names (server-side joins).
  const cards: CaseCardData[] = await Promise.all(
    cases.map(async (caseRow) => {
      const [escrow, parties] = await Promise.all([
        getEscrow(caseRow.id),
        getCaseParties(caseRow.id),
      ]);
      const [partyA, partyB] = await Promise.all([
        partyDisplayName(parties.find((p) => p.party_role === "party_a")),
        partyDisplayName(parties.find((p) => p.party_role === "party_b")),
      ]);
      return { caseRow, escrow, partyA, partyB };
    })
  );

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Cases"
        title="Your cases"
        subtitle="Open a case to manage intake, exchange evidence, communicate securely, and track escrow."
        as="h1"
      />

      {cards.length === 0 ? (
        <EmptyCases />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ caseRow, escrow, partyA, partyB }) => {
            const statusConfig = CASE_STATUS_CONFIG[caseRow.status];
            return (
              <li key={caseRow.id}>
                <Link
                  href={`/dashboard/cases/${caseRow.id}`}
                  className={cn(
                    "group flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md",
                    "transition-colors hover:border-primary/40 hover:bg-card/80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  {/* Header: case number + escrow badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium text-muted-foreground">
                        {caseRow.case_number}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-foreground">
                        {caseRow.title}
                      </h2>
                    </div>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Status row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {escrow ? (
                      <EscrowStatusBadge status={escrow.escrow_status} />
                    ) : null}
                    {statusConfig ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
                          statusConfig.badgeClass
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            statusConfig.dotClass
                          )}
                          aria-hidden="true"
                        />
                        {statusConfig.label}
                      </span>
                    ) : null}
                  </div>

                  {/* Meta */}
                  <dl className="mt-auto space-y-2 text-sm">
                    {caseRow.category ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <dt className="sr-only">Category</dt>
                        <dd className="truncate">{caseRow.category}</dd>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <dt className="sr-only">Parties</dt>
                      <dd className="truncate">
                        <span className="text-foreground">{partyA}</span>
                        <span className="px-1.5 text-muted-foreground">↔</span>
                        <span className="text-foreground">{partyB}</span>
                      </dd>
                    </div>

                    {escrow ? (
                      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Wallet
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          Total escrow
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatCurrency(escrow.total_amount, escrow.currency)}
                        </span>
                      </div>
                    ) : null}
                  </dl>

                  <p className="text-[11px] text-muted-foreground">
                    Updated {formatDate(caseRow.updated_at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyCases() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <FolderKanban className="h-7 w-7" />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        You don&apos;t have any cases yet
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        When an administrator creates a case and adds you as a party, it will
        appear here. You&apos;ll be able to fund escrow, upload evidence, and
        track release status.
      </p>
    </div>
  );
}

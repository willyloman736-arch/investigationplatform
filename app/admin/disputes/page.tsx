// ─────────────────────────────────────────────────────────────────────────────
// Admin disputes — review and resolve every dispute on the platform.
//
// Server Component. Loads all disputes (most recent first), splits them into
// "needs attention" (open / under review) and "resolved", and renders an
// AdminDisputePanel per dispute so the admin can resolve in place.
//
// Resolving to "release" only marks the escrow eligible — the actual release is
// triggered server-side via the protected route. This page never moves funds.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { ShieldAlert, Gavel, CheckCircle2, ArrowUpRight } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { getDisputes, getCaseById } from "@/lib/data";
import type { Case, Dispute } from "@/lib/types";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AdminDisputePanel } from "@/components/admin/AdminDisputePanel";

export const metadata = {
  title: `Disputes · ${APP_NAME}`,
};

interface DisputeWithCase {
  dispute: Dispute;
  caseRow: Case | null;
}

async function loadDisputes(): Promise<DisputeWithCase[]> {
  const disputes = await getDisputes();
  return Promise.all(
    disputes.map(async (dispute) => ({
      dispute,
      caseRow: await getCaseById(dispute.case_id),
    }))
  );
}

export default async function AdminDisputesPage() {
  const all = await loadDisputes();

  const needsAttention = all.filter(
    ({ dispute }) =>
      dispute.status === "open" || dispute.status === "under_review"
  );
  const resolved = all.filter(
    ({ dispute }) =>
      dispute.status !== "open" && dispute.status !== "under_review"
  );

  return (
    <div className="space-y-8">
      <SectionHeading
        as="h1"
        eyebrow="Dispute resolution"
        title="Disputes"
        subtitle="Review contested cases and record resolutions. Resolving a dispute to release only marks the escrow eligible — release still executes server-side after the provider confirms. Every resolution is audited."
      />

      {all.length === 0 ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>No disputes</AlertTitle>
          <AlertDescription>
            There are no disputes on the platform. New disputes will appear here
            for review and resolution.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Needs attention */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Needs attention
              </h2>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                {needsAttention.length}
              </span>
            </div>

            {needsAttention.length === 0 ? (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>All clear</AlertTitle>
                <AlertDescription>
                  No disputes are currently awaiting resolution.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {needsAttention.map(({ dispute, caseRow }) => (
                  <DisputeCard
                    key={dispute.id}
                    dispute={dispute}
                    caseRow={caseRow}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Resolved history */}
          {resolved.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  Resolved
                </h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {resolved.length}
                </span>
              </div>
              <div className="space-y-4">
                {resolved.map(({ dispute, caseRow }) => (
                  <DisputeCard
                    key={dispute.id}
                    dispute={dispute}
                    caseRow={caseRow}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DisputeCard({
  dispute,
  caseRow,
}: {
  dispute: Dispute;
  caseRow: Case | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {caseRow?.title ?? "Case"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {caseRow?.case_number ?? dispute.case_id}
          </p>
        </div>
        {caseRow && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/cases/${caseRow.id}`}>
              Open case
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
      <AdminDisputePanel
        dispute={dispute}
        caseId={dispute.case_id}
        caseNumber={caseRow?.case_number}
      />
    </div>
  );
}

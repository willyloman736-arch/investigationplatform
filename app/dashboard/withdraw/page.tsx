import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  type LucideIcon,
  Wallet,
} from "lucide-react";

import { APP_NAME, PAYOUT_METHOD_LABELS, WITHDRAWAL_STATUS_BADGE_VARIANTS, WITHDRAWAL_STATUS_LABELS } from "@/lib/constants";
import {
  getCurrentUserMock,
  getDisputes,
  getRecoveryOperationsCases,
  getWithdrawalRequestsForUser,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type {
  Dispute,
  EscrowContract,
  Profile,
  RecoveryOperationsCase,
  WithdrawalRequestWithRelations,
} from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  WithdrawalFlow,
  WithdrawalTrustBadges,
} from "@/components/dashboard/WithdrawalFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Withdraw Funds · ${APP_NAME}`,
};

const ACTIVE_REQUEST_STATUSES = new Set([
  "submitted",
  "pending_admin_review",
  "requested",
  "conditions_required",
  "approved_for_processing",
  "processing",
  "approved",
]);

async function resolveProfile(): Promise<Profile> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return getCurrentUserMock("client");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");
  return profile;
}

function chooseOperation(
  operations: RecoveryOperationsCase[],
  requestedCaseId?: string
): RecoveryOperationsCase | null {
  if (requestedCaseId) {
    const requested = operations.find((operation) => operation.id === requestedCaseId);
    if (requested) return requested;
  }

  return (
    operations.find((operation) => {
      const escrow = operation.escrow;
      if (!escrow) return false;
      const status = String(escrow.escrow_status);
      return (
        (status === "ready_for_release" || status === "release_approved") &&
        escrow.release_status === "eligible" &&
        Number(escrow.net_release_amount) > 0
      );
    }) ??
    operations.find((operation) => operation.escrow_available_amount > 0) ??
    operations[0] ??
    null
  );
}

function latestRequestForCase(
  requests: WithdrawalRequestWithRelations[],
  caseId: string
): WithdrawalRequestWithRelations | null {
  return (
    requests
      .filter((request) => request.case_id === caseId)
      .sort((a, b) =>
        (b.submitted_at ?? b.requested_at ?? b.created_at).localeCompare(
          a.submitted_at ?? a.requested_at ?? a.created_at
        )
      )[0] ?? null
  );
}

function hasActiveDispute(disputes: Dispute[], caseId: string): boolean {
  return disputes.some(
    (dispute) =>
      dispute.case_id === caseId &&
      (dispute.status === "open" || dispute.status === "under_review")
  );
}

function eligibleEscrow(escrow: EscrowContract | null): escrow is EscrowContract {
  if (!escrow) return false;
  const status = String(escrow.escrow_status);
  return (
    (status === "ready_for_release" || status === "release_approved") &&
    escrow.release_status === "eligible"
  );
}

export default async function DashboardWithdrawPage({
  searchParams,
}: {
  searchParams?: { caseId?: string };
}) {
  const profile = await resolveProfile();

  if (!profile.is_verified) {
    redirect("/dashboard/kyc");
  }

  const [operations, disputes, requests] = await Promise.all([
    getRecoveryOperationsCases(profile.role, profile.id),
    getDisputes(),
    getWithdrawalRequestsForUser(profile.id),
  ]);

  const operation = chooseOperation(operations, searchParams?.caseId);
  if (!operation || !operation.escrow) {
    return (
      <WithdrawalShell>
        <BlockedState
          icon={Wallet}
          title="No escrow account yet"
          body="Open a recovery complaint first. Once the account is eligible for release, the withdrawal flow will appear here."
          actionHref="/dashboard/cases"
          actionLabel="Open recovery cases"
        />
      </WithdrawalShell>
    );
  }

  const latestRequest = latestRequestForCase(requests, operation.id);
  const requestActive = latestRequest
    ? ACTIVE_REQUEST_STATUSES.has(latestRequest.status)
    : false;
  const activeDispute = hasActiveDispute(disputes, operation.id);
  const openConditions = operation.withdrawal_conditions.filter(
    (condition) => !condition.satisfied
  ).length;
  const availableAmount = Math.max(
    0,
    Number(operation.escrow.net_release_amount ?? operation.escrow_available_amount ?? 0)
  );
  const blocked =
    !eligibleEscrow(operation.escrow) ||
    availableAmount <= 0 ||
    activeDispute ||
    String(operation.escrow.escrow_status) === "release_frozen" ||
    String(operation.escrow.escrow_status) === "under_dispute_audit" ||
    openConditions > 0;

  if (requestActive && latestRequest) {
    return (
      <WithdrawalShell>
        <PendingRequestState request={latestRequest} />
      </WithdrawalShell>
    );
  }

  if (blocked) {
    return (
      <WithdrawalShell>
        <BlockedState
          icon={AlertTriangle}
          title="Withdrawal is currently unavailable while your case is under review."
          body={
            openConditions > 0
              ? "Your file has release requirements that must be completed before a payout request can be submitted."
              : activeDispute
              ? "A dispute or review hold is active on this escrow account. Transfers remain paused until the review is resolved."
              : "Release eligibility has not been finalized for this escrow account yet."
          }
          actionHref={`/dashboard/cases/${operation.id}`}
          actionLabel="View case details"
        />
      </WithdrawalShell>
    );
  }

  return (
    <WithdrawalFlow
      profile={profile}
      operation={operation}
      escrow={operation.escrow}
      availableAmount={availableAmount}
      kycStatus={profile.kyc_status}
    />
  );
}

function WithdrawalShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-24 lg:pb-8">
      <header className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Back to dashboard</span>
          </Link>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Secure payout
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Withdraw Funds
          </h1>
        </div>
      </header>
      {children}
      <WithdrawalTrustBadges />
    </div>
  );
}

function BlockedState({
  icon: Icon,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 text-center shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-400/25">
        <Icon className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="mx-auto mt-5 max-w-2xl text-2xl font-semibold text-foreground">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <Button asChild className="mt-6 h-12 rounded-xl">
        <Link href={actionHref}>
          {actionLabel}
          <FileCheck2 className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}

function PendingRequestState({
  request,
}: {
  request: WithdrawalRequestWithRelations;
}) {
  const method = request.withdrawal_method ?? request.method;
  const needsInfo = request.admin_review_status === "needs_more_information";
  const approved = request.status === "approved_for_processing" || request.status === "approved";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          {approved ? (
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          ) : needsInfo ? (
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          ) : (
            <Clock className="h-7 w-7" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={WITHDRAWAL_STATUS_BADGE_VARIANTS[request.status]}>
              {WITHDRAWAL_STATUS_LABELS[request.status]}
            </Badge>
            <Badge variant={needsInfo ? "warning" : "info"}>
              {needsInfo ? "More information needed" : "Provider review"}
            </Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">
            Withdrawal request submitted
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Your payout will be processed after final provider verification.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatusTile label="Request ID" value={request.id} />
        <StatusTile
          label="Amount"
          value={formatCurrency(request.amount, request.currency)}
        />
        <StatusTile label="Method" value={PAYOUT_METHOD_LABELS[method]} />
        <StatusTile
          label="Submitted"
          value={formatDateTime(request.submitted_at ?? request.requested_at)}
        />
      </div>

      {request.admin_notes || request.admin_note ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] p-4 text-sm leading-relaxed text-amber-100">
          {request.admin_notes ?? request.admin_note}
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-12 rounded-xl">
          <Link href={`/dashboard/cases/${request.case_id}`}>
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            View case
          </Link>
        </Button>
        <Button asChild className="h-12 rounded-xl">
          <Link href="/dashboard">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Back to escrow
          </Link>
        </Button>
      </div>
    </section>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

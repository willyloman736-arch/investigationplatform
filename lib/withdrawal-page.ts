import { redirect } from "next/navigation";

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

const ACTIVE_REQUEST_STATUSES = new Set([
  "submitted",
  "pending_review",
  "awaiting_fee_completion",
  "pending_admin_review",
  "requested",
  "conditions_required",
  "approved_for_processing",
  "processing",
  "approved",
]);

export interface WithdrawalCheckoutContext {
  profile: Profile;
  operation: RecoveryOperationsCase;
  escrow: EscrowContract;
  availableAmount: number;
}

export interface WithdrawalBlockedContext {
  blocked: true;
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}

async function resolveProfile(): Promise<Profile> {
  if (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
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

export async function getWithdrawalCheckoutContext(
  requestedCaseId?: string
): Promise<WithdrawalCheckoutContext | WithdrawalBlockedContext> {
  const profile = await resolveProfile();

  if (!profile.is_verified) {
    redirect("/dashboard/kyc");
  }

  const [operations, disputes, requests] = await Promise.all([
    getRecoveryOperationsCases(profile.role, profile.id),
    getDisputes(),
    getWithdrawalRequestsForUser(profile.id),
  ]);

  const operation = chooseOperation(operations, requestedCaseId);
  if (!operation || !operation.escrow) {
    return {
      blocked: true,
      title: "No eligible escrow account yet",
      body: "Once your escrow account is eligible for release, withdrawal setup will become available.",
      actionHref: "/dashboard/cases",
      actionLabel: "Open recovery cases",
    };
  }

  const latestRequest = latestRequestForCase(requests, operation.id);
  if (latestRequest && ACTIVE_REQUEST_STATUSES.has(latestRequest.status)) {
    return {
      blocked: true,
      title: "Withdrawal request already submitted",
      body: "Your current withdrawal request is in review or payout processing. You can track it from the escrow dashboard.",
      actionHref: "/dashboard",
      actionLabel: "Return to dashboard",
    };
  }

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

  if (blocked) {
    return {
      blocked: true,
      title: "Withdrawal is currently unavailable while your case is under review.",
      body:
        openConditions > 0
          ? "Release requirements must be completed before a payout request can be submitted."
          : activeDispute
          ? "A review hold is active on this escrow account. Transfers remain paused until the review is resolved."
          : "Release eligibility has not been finalized for this escrow account yet.",
      actionHref: `/dashboard/cases/${operation.id}`,
      actionLabel: "View case details",
    };
  }

  return {
    profile,
    operation,
    escrow: operation.escrow,
    availableAmount,
  };
}

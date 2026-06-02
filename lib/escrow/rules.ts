// ─────────────────────────────────────────────────────────────────────────────
// Pure escrow state-machine rules.
//
// NO Supabase / Next / IO imports — only the DECISION logic for the money path,
// so it can be unit-tested in isolation and reused by both the protected release
// route (app/api/escrow/release/route.ts) and the approval server action
// (lib/actions/approvals.ts). These functions decide; the callers do the IO.
// They NEVER move money.
// ─────────────────────────────────────────────────────────────────────────────

import type { EscrowContract, PartyRole } from "@/lib/types";

/** Minimal shape of an approval row needed to decide eligibility. */
export interface ApprovalRecord {
  party_role: PartyRole | string;
  approved: boolean | null;
}

/** The escrow fields the rules read (a subset of EscrowContract). */
export type EscrowRuleState = Pick<
  EscrowContract,
  | "escrow_status"
  | "deposit_status"
  | "release_status"
  | "release_eligibility_reason"
>;

/** True only when BOTH Party A and Party B have an approved record. */
export function bothPartiesApproved(
  approvals: ApprovalRecord[] | null | undefined
): boolean {
  const approvedFor = (role: PartyRole) =>
    Boolean(
      approvals?.some((a) => a.party_role === role && a.approved === true)
    );
  return approvedFor("party_a") && approvedFor("party_b");
}

/**
 * True when an admin granted release eligibility (the dispute-resolution /
 * override path): release_status is "eligible" AND a non-empty reason is stored.
 */
export function hasAdminReleaseEligibility(
  escrow: Pick<EscrowRuleState, "release_status" | "release_eligibility_reason">
): boolean {
  return (
    escrow.release_status === "eligible" &&
    Boolean(escrow.release_eligibility_reason?.trim())
  );
}

/**
 * Core release rule: a release is permitted iff BOTH parties approved, OR an
 * admin granted release eligibility. (Guard rails are checked separately by
 * evaluateRelease.)
 */
export function isReleaseEligible(
  escrow: EscrowRuleState,
  approvals: ApprovalRecord[] | null | undefined
): boolean {
  return bothPartiesApproved(approvals) || hasAdminReleaseEligibility(escrow);
}

export type ReleaseBlockCode =
  | "already_released"
  | "frozen"
  | "under_dispute"
  | "deposit_not_received"
  | "not_eligible";

export interface ReleaseEvaluation {
  ok: boolean;
  code: ReleaseBlockCode | null;
  reason: string;
  via: "mutual_approval" | "admin_eligibility" | null;
}

/**
 * The complete server-side gate for POST /api/escrow/release. Checks guard rails
 * in order, then eligibility. Returns ok:true with the eligibility path, or
 * ok:false with the first blocking reason + a code (the route maps "not_eligible"
 * to HTTP 403 and the guard-rail codes to 409).
 *
 * This is the single source of truth for "may these funds be released?" — it is
 * exhaustively unit-tested and performs NO IO and moves NO money.
 */
export function evaluateRelease(
  escrow: EscrowRuleState,
  approvals: ApprovalRecord[] | null | undefined
): ReleaseEvaluation {
  if (
    escrow.escrow_status === "released" ||
    escrow.release_status === "completed"
  ) {
    return {
      ok: false,
      code: "already_released",
      reason: "This escrow has already been released.",
      via: null,
    };
  }
  if (escrow.escrow_status === "release_frozen") {
    return {
      ok: false,
      code: "frozen",
      reason: "Release is frozen by an administrator.",
      via: null,
    };
  }
  if (escrow.escrow_status === "under_dispute_audit") {
    return {
      ok: false,
      code: "under_dispute",
      reason: "Release is blocked while a dispute is under review.",
      via: null,
    };
  }
  if (escrow.deposit_status !== "received") {
    return {
      ok: false,
      code: "deposit_not_received",
      reason: "Funds have not been confirmed as deposited yet.",
      via: null,
    };
  }

  const mutual = bothPartiesApproved(approvals);
  const admin = hasAdminReleaseEligibility(escrow);
  if (!mutual && !admin) {
    return {
      ok: false,
      code: "not_eligible",
      reason:
        "Release is not eligible: both parties must approve, or an admin must resolve a dispute to release.",
      via: null,
    };
  }

  return {
    ok: true,
    code: null,
    reason: mutual
      ? "Both parties approved the release."
      : escrow.release_eligibility_reason ??
        "Admin-approved release eligibility.",
    via: mutual ? "mutual_approval" : "admin_eligibility",
  };
}

/**
 * Whether a party may submit or change an approval right now. Approvals are
 * paused while the escrow is frozen or under dispute audit, and closed once the
 * escrow has been released.
 */
export function canSubmitApproval(
  escrow: Pick<EscrowRuleState, "escrow_status">
): { ok: boolean; reason?: string } {
  if (
    escrow.escrow_status === "release_frozen" ||
    escrow.escrow_status === "under_dispute_audit"
  ) {
    return {
      ok: false,
      reason:
        "Approvals are paused while this escrow is frozen or under dispute review.",
    };
  }
  if (escrow.escrow_status === "released") {
    return { ok: false, reason: "This escrow has already been released." };
  }
  return { ok: true };
}

/** A non-empty (trimmed) reason is required for every admin escrow override. */
export function isValidReason(reason: string | null | undefined): boolean {
  return Boolean(reason && reason.trim().length > 0);
}

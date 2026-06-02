"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Admin escrow-control server actions.
//
// SERVER-ONLY. These let an admin reflect provider/webhook state and steer the
// escrow STATE MACHINE — they NEVER move money. The only place a release is
// actually triggered is POST /api/escrow/release.
//
// Rules encoded here (see SPEC ESCROW STATE MACHINE & RELEASE RULES):
//  - adminSetEscrowStatus REQUIRES a non-empty reason (throws if empty) and is
//    audited WITH the reason.
//  - confirmDeposit only REFLECTS a provider/webhook confirmation.
//  - approveReleaseEligibility / freezeRelease / requestAdditionalVerification
//    move status only, with an audited reason.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { ESCROW_STATUS_CONFIG } from "@/lib/constants";
import { isValidReason } from "@/lib/escrow/rules";
import type { EscrowStatus, EscrowContract } from "@/lib/types";
import {
  getAuthContext,
  requireAdmin,
  ok,
  fail,
  type ActionResult,
  type AuthContext,
} from "@/lib/actions/_helpers";

const ESCROW_STATUSES = Object.keys(ESCROW_STATUS_CONFIG) as EscrowStatus[];

/**
 * Shared loader: fetch the escrow contract for a case (admin context). Returns
 * the contract or null. Callers handle the null case with a friendly error.
 */
async function loadEscrow(
  ctx: AuthContext,
  caseId: string
): Promise<EscrowContract | null> {
  const { data } = await ctx.supabase
    .from("escrow_contracts")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle<EscrowContract>();
  return data ?? null;
}

// ── adminSetEscrowStatus ─────────────────────────────────────────────────────

const adminSetStatusSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum([
    "pending_deposit",
    "securely_escrowed",
    "under_dispute_audit",
    "ready_for_release",
    "release_frozen",
    "released",
  ]),
  reason: z.string().trim().min(1),
});

export interface AdminSetEscrowStatusInput {
  caseId: string;
  status: EscrowStatus;
  reason: string;
}

/**
 * Generic admin override of escrow_status. The reason is REQUIRED — an empty
 * reason throws (the dialog enforces this client-side too). Audited WITH reason.
 *
 * NOTE: setting status to "released" here is intentionally rejected. A release
 * is only ever finalized by the provider via the release route / webhook, never
 * by a manual status override.
 */
export async function adminSetEscrowStatus(
  input: AdminSetEscrowStatusInput
): Promise<ActionResult> {
  // Enforce a non-empty reason explicitly so the failure is unambiguous.
  if (!isValidReason(input.reason)) {
    throw new Error("A reason is required to change the escrow status.");
  }

  const parsed = adminSetStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid status change.");
  }
  if (!ESCROW_STATUSES.includes(parsed.data.status)) {
    return fail("Unknown escrow status.");
  }
  if (parsed.data.status === "released") {
    return fail(
      "Funds can only be marked released by the provider via the release flow, not by manual override."
    );
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  requireAdmin(ctx.profile);

  const escrow = await loadEscrow(ctx, parsed.data.caseId);
  if (!escrow) {
    return fail("No escrow contract exists for this case.");
  }

  // Keep release_status coherent with a manual status move.
  const releaseStatusPatch =
    parsed.data.status === "ready_for_release"
      ? { release_status: "eligible" as const }
      : parsed.data.status === "securely_escrowed" ||
        parsed.data.status === "pending_deposit"
      ? { release_status: "not_started" as const }
      : {};

  const { error } = await ctx.supabase
    .from("escrow_contracts")
    .update({
      escrow_status: parsed.data.status,
      ...releaseStatusPatch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", escrow.id);

  if (error) {
    return fail(error.message);
  }

  await logAudit(ctx.supabase, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "escrow.status_override",
    entityType: "escrow_contract",
    entityId: escrow.id,
    metadata: { from: escrow.escrow_status, to: parsed.data.status },
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  return ok();
}

// ── confirmDeposit ───────────────────────────────────────────────────────────

const confirmDepositSchema = z.object({
  caseId: z.string().min(1),
  providerReference: z.string().trim().min(1, "Provider reference is required."),
});

export interface ConfirmDepositInput {
  caseId: string;
  providerReference: string;
}

/**
 * Reflect a provider/webhook-confirmed deposit: deposit_status="received" and
 * escrow_status="securely_escrowed". This does NOT move money — it records that
 * the licensed provider confirmed funds are held. Audited.
 */
export async function confirmDeposit(
  input: ConfirmDepositInput
): Promise<ActionResult> {
  const parsed = confirmDepositSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid deposit confirmation.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  requireAdmin(ctx.profile);

  const escrow = await loadEscrow(ctx, parsed.data.caseId);
  if (!escrow) {
    return fail("No escrow contract exists for this case.");
  }

  const { error } = await ctx.supabase
    .from("escrow_contracts")
    .update({
      deposit_status: "received",
      escrow_status: "securely_escrowed",
      provider_reference: parsed.data.providerReference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", escrow.id);

  if (error) {
    return fail(error.message);
  }

  // Append a deposit transaction to the ledger (provider-confirmed; no math).
  await ctx.supabase.from("escrow_transactions").insert({
    escrow_contract_id: escrow.id,
    case_id: parsed.data.caseId,
    type: "deposit",
    amount: escrow.total_amount,
    currency: escrow.currency,
    provider_reference: parsed.data.providerReference,
    provider_status: "confirmed",
    status: "confirmed",
    initiated_by: ctx.profile.id,
    notes: "Deposit confirmed via licensed provider.",
  });

  await logAudit(ctx.supabase, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "escrow.deposit_confirmed",
    entityType: "escrow_contract",
    entityId: escrow.id,
    metadata: { providerReference: parsed.data.providerReference },
    reason: "Provider confirmed the funding deposit.",
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  return ok();
}

// ── freezeRelease ────────────────────────────────────────────────────────────

const freezeReleaseSchema = z.object({
  caseId: z.string().min(1),
  reason: z.string().trim().min(1),
});

export interface FreezeReleaseInput {
  caseId: string;
  reason: string;
}

/**
 * Freeze release pending additional verification: escrow_status="release_frozen".
 * Reason REQUIRED (throws if empty). Audited WITH reason. No money moves.
 */
export async function freezeRelease(
  input: FreezeReleaseInput
): Promise<ActionResult> {
  if (!isValidReason(input.reason)) {
    throw new Error("A reason is required to freeze a release.");
  }

  const parsed = freezeReleaseSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid freeze request.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  requireAdmin(ctx.profile);

  const escrow = await loadEscrow(ctx, parsed.data.caseId);
  if (!escrow) {
    return fail("No escrow contract exists for this case.");
  }

  const { error } = await ctx.supabase
    .from("escrow_contracts")
    .update({
      escrow_status: "release_frozen",
      updated_at: new Date().toISOString(),
    })
    .eq("id", escrow.id);

  if (error) {
    return fail(error.message);
  }

  await logAudit(ctx.supabase, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "escrow.release_frozen",
    entityType: "escrow_contract",
    entityId: escrow.id,
    metadata: { previousStatus: escrow.escrow_status },
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  return ok();
}

// ── requestAdditionalVerification ────────────────────────────────────────────

const requestVerificationSchema = z.object({
  caseId: z.string().min(1),
  party: z.enum(["party_a", "party_b", "observer"]),
  reason: z.string().trim().min(1),
});

export interface RequestAdditionalVerificationInput {
  caseId: string;
  party: "party_a" | "party_b" | "observer";
  reason: string;
}

/**
 * Request additional verification from a party and freeze release while it is
 * outstanding. Reason REQUIRED (throws if empty). Audited WITH reason. No money
 * moves.
 */
export async function requestAdditionalVerification(
  input: RequestAdditionalVerificationInput
): Promise<ActionResult> {
  if (!isValidReason(input.reason)) {
    throw new Error("A reason is required to request additional verification.");
  }

  const parsed = requestVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  requireAdmin(ctx.profile);

  const escrow = await loadEscrow(ctx, parsed.data.caseId);
  if (!escrow) {
    return fail("No escrow contract exists for this case.");
  }

  // Hold the release while verification is pending.
  const { error } = await ctx.supabase
    .from("escrow_contracts")
    .update({
      escrow_status: "release_frozen",
      updated_at: new Date().toISOString(),
    })
    .eq("id", escrow.id);

  if (error) {
    return fail(error.message);
  }

  await logAudit(ctx.supabase, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "escrow.additional_verification_requested",
    entityType: "escrow_contract",
    entityId: escrow.id,
    metadata: { party: parsed.data.party },
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  return ok();
}

// ── approveReleaseEligibility ────────────────────────────────────────────────

const approveEligibilitySchema = z.object({
  caseId: z.string().min(1),
  reason: z.string().trim().min(1),
});

export interface ApproveReleaseEligibilityInput {
  caseId: string;
  reason: string;
}

/**
 * Admin grants release eligibility (the dispute-resolution / override path):
 * escrow_status="ready_for_release", release_status="eligible", and the reason
 * is stored on release_eligibility_reason. Reason REQUIRED (throws if empty).
 * Audited. Does NOT move money — it only unlocks the release route.
 */
export async function approveReleaseEligibility(
  input: ApproveReleaseEligibilityInput
): Promise<ActionResult> {
  if (!isValidReason(input.reason)) {
    throw new Error("A reason is required to approve release eligibility.");
  }

  const parsed = approveEligibilitySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid eligibility approval.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  requireAdmin(ctx.profile);

  const escrow = await loadEscrow(ctx, parsed.data.caseId);
  if (!escrow) {
    return fail("No escrow contract exists for this case.");
  }
  if (escrow.escrow_status === "released") {
    return fail("This escrow has already been released.");
  }

  const { error } = await ctx.supabase
    .from("escrow_contracts")
    .update({
      escrow_status: "ready_for_release",
      release_status: "eligible",
      release_eligibility_reason: parsed.data.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", escrow.id);

  if (error) {
    return fail(error.message);
  }

  await logAudit(ctx.supabase, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "escrow.release_eligibility_approved",
    entityType: "escrow_contract",
    entityId: escrow.id,
    metadata: { via: "admin_override" },
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  return ok();
}

"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Admin dispute / oversight server actions: openDispute, resolveDispute,
// flagActivity, requestEvidence.
//
// SERVER-ONLY. Disputes gate the escrow state machine; resolving a dispute as
// "release" sets release eligibility (the admin-override path in the RELEASE
// RULES) but still NEVER moves money — the release route does that. Every action
// is audited and revalidates affected routes.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import type {
  DisputeStatus,
  EscrowContract,
  CaseStatus,
} from "@/lib/types";
import {
  getAuthContext,
  requireAdmin,
  userCanAccessCase,
  ok,
  fail,
  type ActionResult,
} from "@/lib/actions/_helpers";

// ── openDispute ──────────────────────────────────────────────────────────────

const openDisputeSchema = z.object({
  caseId: z.string().min(1),
  reason: z.string().trim().min(1, "Please describe the dispute."),
});

export interface OpenDisputeInput {
  caseId: string;
  reason: string;
}

/**
 * Open a dispute on a case. A party to the case OR an admin may open one. Sets
 * case_status="under_dispute" and escrow_status="under_dispute_audit" so release
 * is blocked while it is reviewed. Audited.
 */
export async function openDispute(
  input: OpenDisputeInput
): Promise<ActionResult<{ disputeId: string }>> {
  const parsed = openDisputeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid dispute.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok({ disputeId: "demo-dispute" });
  }
  const { supabase, profile } = ctx;

  const allowed = await userCanAccessCase(supabase, profile, parsed.data.caseId);
  if (!allowed) {
    return fail("You do not have access to this case.");
  }

  const { data: dispute, error } = await supabase
    .from("disputes")
    .insert({
      case_id: parsed.data.caseId,
      opened_by: profile.id,
      reason: parsed.data.reason,
      status: "open" as DisputeStatus,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !dispute) {
    return fail(error?.message ?? "Could not open the dispute.");
  }

  // Gate the case + escrow so nothing can be released during review.
  await supabase
    .from("cases")
    .update({
      status: "under_dispute" as CaseStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.caseId);

  await supabase
    .from("escrow_contracts")
    .update({
      escrow_status: "under_dispute_audit",
      updated_at: new Date().toISOString(),
    })
    .eq("case_id", parsed.data.caseId);

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: parsed.data.caseId,
    action: "dispute.opened",
    entityType: "dispute",
    entityId: dispute.id,
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  revalidatePath("/admin/disputes");
  return ok({ disputeId: dispute.id });
}

// ── resolveDispute ───────────────────────────────────────────────────────────

const resolveDisputeSchema = z.object({
  disputeId: z.string().min(1),
  resolution: z.enum(["release", "refund", "reject"]),
  reason: z.string().trim().min(1, "A resolution note is required."),
});

export interface ResolveDisputeInput {
  disputeId: string;
  resolution: "release" | "refund" | "reject";
  reason: string;
}

/**
 * Resolve a dispute (admin-only). Reason REQUIRED (throws if empty).
 *  - "release" → set escrow eligible for release (ready_for_release / eligible)
 *    with the resolution reason stored on release_eligibility_reason. Money is
 *    NOT moved here; the release route finalizes via the provider.
 *  - "refund"  → mark the dispute resolved_refund and freeze release. The actual
 *    refund is a provider action (TODO(provider)).
 *  - "reject"  → dispute rejected; escrow returns to securely_escrowed.
 * Audited WITH reason.
 */
export async function resolveDispute(
  input: ResolveDisputeInput
): Promise<ActionResult> {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("A resolution note is required to resolve a dispute.");
  }

  const parsed = resolveDisputeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid resolution.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  const { supabase, profile } = ctx;
  requireAdmin(profile);

  // Load the dispute to find its case.
  const { data: dispute } = await supabase
    .from("disputes")
    .select("id, case_id, status")
    .eq("id", parsed.data.disputeId)
    .maybeSingle<{ id: string; case_id: string; status: DisputeStatus }>();

  if (!dispute) {
    return fail("Dispute not found.");
  }

  const statusMap: Record<typeof parsed.data.resolution, DisputeStatus> = {
    release: "resolved_release",
    refund: "resolved_refund",
    reject: "rejected",
  };
  const newDisputeStatus = statusMap[parsed.data.resolution];

  const { error: disputeError } = await supabase
    .from("disputes")
    .update({
      status: newDisputeStatus,
      resolution_note: parsed.data.reason,
      resolved_by: profile.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.disputeId);

  if (disputeError) {
    return fail(disputeError.message);
  }

  // Load escrow to apply the resolution effects.
  const { data: escrow } = await supabase
    .from("escrow_contracts")
    .select("*")
    .eq("case_id", dispute.case_id)
    .maybeSingle<EscrowContract>();

  if (escrow) {
    if (parsed.data.resolution === "release") {
      // Admin-override release-eligibility path (mirrors RELEASE RULES).
      await supabase
        .from("escrow_contracts")
        .update({
          escrow_status: "ready_for_release",
          release_status: "eligible",
          release_eligibility_reason: `Dispute resolved to release: ${parsed.data.reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrow.id);
    } else if (parsed.data.resolution === "refund") {
      // Freeze release; the refund itself is a provider action.
      // TODO(provider): issue a refund via the licensed provider and append a
      // "refund" escrow_transactions row when the provider confirms.
      await supabase
        .from("escrow_contracts")
        .update({
          escrow_status: "release_frozen",
          release_status: "not_started",
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrow.id);
    } else {
      // Rejected: return escrow to the held state.
      await supabase
        .from("escrow_contracts")
        .update({
          escrow_status: "securely_escrowed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrow.id);
    }
  }

  // Re-activate the case (it is no longer under dispute).
  await supabase
    .from("cases")
    .update({
      status: "active" as CaseStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dispute.case_id);

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: dispute.case_id,
    action: "dispute.resolved",
    entityType: "dispute",
    entityId: dispute.id,
    metadata: { resolution: parsed.data.resolution },
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/cases/${dispute.case_id}`);
  revalidatePath(`/dashboard/cases/${dispute.case_id}`);
  revalidatePath("/admin/disputes");
  return ok();
}

// ── flagActivity ─────────────────────────────────────────────────────────────

const flagActivitySchema = z.object({
  caseId: z.string().min(1),
  reason: z.string().trim().min(1, "Describe what you are flagging."),
});

export interface FlagActivityInput {
  caseId: string;
  reason: string;
}

/**
 * Flag suspicious activity on a case for review and suspend it. Admin-only.
 * Reason REQUIRED (throws if empty). Audited WITH reason. No money moves.
 */
export async function flagActivity(
  input: FlagActivityInput
): Promise<ActionResult> {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("A reason is required to flag activity.");
  }

  const parsed = flagActivitySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid flag.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  const { supabase, profile } = ctx;
  requireAdmin(profile);

  // Suspend the case and freeze any release while the flag is investigated.
  await supabase
    .from("cases")
    .update({
      status: "suspended" as CaseStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.caseId);

  await supabase
    .from("escrow_contracts")
    .update({
      escrow_status: "release_frozen",
      updated_at: new Date().toISOString(),
    })
    .eq("case_id", parsed.data.caseId);

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: parsed.data.caseId,
    action: "case.activity_flagged",
    entityType: "case",
    entityId: parsed.data.caseId,
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  revalidatePath("/admin/cases");
  return ok();
}

// ── requestEvidence ──────────────────────────────────────────────────────────

const requestEvidenceSchema = z.object({
  caseId: z.string().min(1),
  party: z.enum(["party_a", "party_b", "observer"]),
  note: z.string().trim().min(1, "Describe the evidence you need."),
});

export interface RequestEvidenceInput {
  caseId: string;
  party: "party_a" | "party_b" | "observer";
  note: string;
}

/**
 * Request additional evidence from a party (admin-only). Recorded as a system
 * message on the case thread and audited. Note REQUIRED (throws if empty).
 * No status change, no money movement.
 */
export async function requestEvidence(
  input: RequestEvidenceInput
): Promise<ActionResult> {
  if (!input.note || input.note.trim().length === 0) {
    throw new Error("A note is required to request evidence.");
  }

  const parsed = requestEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid evidence request.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  const { supabase, profile } = ctx;
  requireAdmin(profile);

  // Surface the request to the parties as a message on the case thread.
  await supabase.from("chat_messages").insert({
    case_id: parsed.data.caseId,
    sender_id: profile.id,
    body: `Evidence request (${parsed.data.party}): ${parsed.data.note}`,
    read: false,
  });

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: parsed.data.caseId,
    action: "evidence.requested",
    entityType: "case",
    entityId: parsed.data.caseId,
    metadata: { party: parsed.data.party },
    reason: parsed.data.note,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  return ok();
}

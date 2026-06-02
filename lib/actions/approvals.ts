"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Release-approval server action: submitApproval.
//
// SERVER-ONLY. A party records their approval to release escrow. When BOTH
// party_a AND party_b have approved, the escrow contract is moved to
// escrow_status="ready_for_release" and release_status="eligible".
//
// CRITICAL: this NEVER moves money. Marking eligibility is the most this action
// (or any client) can do — the actual release happens ONLY via the protected
// POST /api/escrow/release route after a re-check.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import type { EscrowContract } from "@/lib/types";
import { bothPartiesApproved, canSubmitApproval } from "@/lib/escrow/rules";
import {
  getAuthContext,
  userCanAccessCase,
  partyRoleForUser,
  isAdmin,
  ok,
  fail,
  type ActionResult,
} from "@/lib/actions/_helpers";

const submitApprovalSchema = z.object({
  caseId: z.string().min(1),
  partyRole: z.enum(["party_a", "party_b"]),
  note: z.string().trim().max(2000).optional().default(""),
});

export interface SubmitApprovalInput {
  caseId: string;
  partyRole: "party_a" | "party_b";
  note?: string;
}

/**
 * Upsert the calling party's release approval for a case. If both party_a and
 * party_b are now approved, flip the escrow contract to ready_for_release /
 * eligible. Audited. Does NOT release funds.
 */
export async function submitApproval(
  input: SubmitApprovalInput
): Promise<ActionResult<{ bothApproved: boolean }>> {
  const parsed = submitApprovalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid approval.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok({ bothApproved: false });
  }
  const { supabase, profile } = ctx;
  const { caseId, partyRole, note } = parsed.data;

  // Access control + party authorization: a non-admin may ONLY approve for the
  // party role they actually hold on this case. Admins may record on behalf of a
  // party (e.g. an in-person confirmation), but cannot themselves move money.
  const allowed = await userCanAccessCase(supabase, profile, caseId);
  if (!allowed) {
    return fail("You do not have access to this case.");
  }
  if (!isAdmin(profile)) {
    const myRole = await partyRoleForUser(supabase, profile, caseId);
    if (myRole !== partyRole) {
      return fail("You can only approve on behalf of your own party.");
    }
  }

  // Locate the escrow contract (approvals reference it).
  const { data: escrow } = await supabase
    .from("escrow_contracts")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle<EscrowContract>();

  if (!escrow) {
    return fail("No escrow contract exists for this case yet.");
  }

  // Block approvals when the escrow is frozen, under dispute audit, or already
  // released (canSubmitApproval is unit-tested in lib/escrow/rules.test.ts).
  const gate = canSubmitApproval(escrow);
  if (!gate.ok) {
    return fail(gate.reason ?? "Approvals are not allowed in the current state.");
  }

  // Upsert the approval on (case_id, party_role).
  const { error: upsertError } = await supabase.from("approvals").upsert(
    {
      case_id: caseId,
      escrow_contract_id: escrow.id,
      party_role: partyRole,
      approved_by: profile.id,
      approved: true,
      note: note || null,
    },
    { onConflict: "case_id,party_role" }
  );

  if (upsertError) {
    return fail(upsertError.message);
  }

  await logAudit(supabase, {
    actorId: profile.id,
    caseId,
    action: "approval.submitted",
    entityType: "approval",
    entityId: escrow.id,
    metadata: { partyRole },
    reason: note || null,
  });

  // Re-check whether BOTH parties have now approved.
  const { data: approvals } = await supabase
    .from("approvals")
    .select("party_role, approved")
    .eq("case_id", caseId);

  const bothApproved = bothPartiesApproved(approvals ?? []);

  if (bothApproved && escrow.escrow_status !== "ready_for_release") {
    const { error: escrowError } = await supabase
      .from("escrow_contracts")
      .update({
        escrow_status: "ready_for_release",
        release_status: "eligible",
        release_eligibility_reason:
          "Both parties (Party A and Party B) approved the release.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrow.id);

    if (!escrowError) {
      await logAudit(supabase, {
        actorId: profile.id,
        caseId,
        action: "escrow.release_eligible",
        entityType: "escrow_contract",
        entityId: escrow.id,
        metadata: { via: "mutual_approval" },
        reason: "Both parties approved the release.",
      });
    }
  }

  revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath(`/admin/cases/${caseId}`);
  return ok({ bothApproved });
}

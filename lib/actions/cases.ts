"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Case lifecycle server actions: createCase, updateCaseStatus, assignParties,
// signContract.
//
// SERVER-ONLY. Every action enforces role/ownership, writes an audit_logs row,
// and revalidates the affected route. No money movement happens here.
// In DEMO mode (no Supabase session) actions no-op gracefully so the UI stays
// demonstrable.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { PLATFORM_FEE_RATE, PROVIDER_FEE_RATE } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/server";
import type { CaseStatus, PartyRole } from "@/lib/types";
import {
  getAuthContext,
  isAdmin,
  partyRoleForUser,
  requireAdmin,
  userCanAccessCase,
  ok,
  fail,
  type ActionResult,
} from "@/lib/actions/_helpers";

const CASE_STATUSES: CaseStatus[] = [
  "draft",
  "active",
  "suspended",
  "closed",
  "under_dispute",
];

// ── createCase ───────────────────────────────────────────────────────────────

const createCaseSchema = z.object({
  title: z.string().trim().min(3, "Title is required.").max(160),
  description: z.string().trim().max(4000).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  totalAmount: z.coerce
    .number()
    .min(0, "Amount must be zero or greater.")
    .max(1_000_000_000),
  currency: z.string().trim().min(3).max(8).optional().default("USD"),
  contractTerms: z.string().trim().max(20000).optional().default(""),
  partyAEmail: z.string().trim().email().optional().or(z.literal("")),
  partyBEmail: z.string().trim().email().optional().or(z.literal("")),
});

export interface CreateCaseInput {
  title: string;
  description?: string;
  category?: string;
  totalAmount: number;
  currency?: string;
  contractTerms?: string;
  partyAEmail?: string;
  partyBEmail?: string;
}

/**
 * Create a new case. Admins (or authenticated clients, per RLS) may create.
 * Also seeds the associated escrow_contracts row with display-only fee math
 * (platform fee + provider fee → net release). NO balances are ever moved.
 */
export async function createCase(
  input: CreateCaseInput
): Promise<ActionResult<{ caseId: string; caseNumber: string }>> {
  const parsed = createCaseSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid case details.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode — no Supabase session. Return success so the UI stays
    // demonstrable without persisting anything.
    return ok({ caseId: "demo-case", caseNumber: "AEG-DEMO-0000" });
  }
  const { supabase, profile } = ctx;

  const {
    title,
    description,
    category,
    totalAmount,
    currency,
    contractTerms,
    partyAEmail,
    partyBEmail,
  } = parsed.data;

  // Generate a human-readable case number: AEG-<year>-<4 digit sequence>.
  const year = new Date().getUTCFullYear();
  const { count } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true });
  const sequence = String((count ?? 0) + 1).padStart(4, "0");
  const caseNumber = `AEG-${year}-${sequence}`;

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .insert({
      case_number: caseNumber,
      title,
      description: description || null,
      category: category || null,
      status: "draft" as CaseStatus,
      created_by: profile.id,
      contract_terms: contractTerms || null,
    })
    .select("id, case_number")
    .single<{ id: string; case_number: string }>();

  if (caseError || !caseRow) {
    return fail(caseError?.message ?? "Could not create the case.");
  }

  // Seed the escrow contract with display-only fee math (no balance movement).
  const platformFee = round2(totalAmount * PLATFORM_FEE_RATE);
  const providerFee = round2(totalAmount * PROVIDER_FEE_RATE);
  const netRelease = round2(totalAmount - platformFee - providerFee);
  const admin = createAdminClient();

  const { data: escrowRow } = await admin
    .from("escrow_contracts")
    .insert({
      case_id: caseRow.id,
      currency: currency || "USD",
      total_amount: totalAmount,
      platform_fee: platformFee,
      provider_fee: providerFee,
      net_release_amount: netRelease,
      escrow_status: "pending_deposit",
      deposit_status: "awaiting",
      release_status: "not_started",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (profile.role !== "admin") {
    await admin
      .from("profiles")
      .update({
        kyc_status: "not_started",
        is_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    await admin.from("recovery_kyc_reviews").upsert(
      {
        case_id: caseRow.id,
        profile_id: profile.id,
        status: "not_started",
        government_id_status: "not_submitted",
        selfie_status: "not_submitted",
        proof_of_address_status: "not_submitted",
        phone_verified: false,
        email_verified: Boolean(profile.email),
        review_note: "KYC required automatically after case intake.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id" }
    );
  }

  // Seed party invitations when provided.
  const parties: {
    case_id: string;
    invited_email: string;
    party_role: PartyRole;
    accepted: boolean;
  }[] = [];
  if (partyAEmail) {
    parties.push({
      case_id: caseRow.id,
      invited_email: partyAEmail,
      party_role: "party_a",
      accepted: false,
    });
  }
  if (partyBEmail) {
    parties.push({
      case_id: caseRow.id,
      invited_email: partyBEmail,
      party_role: "party_b",
      accepted: false,
    });
  }
  if (parties.length > 0) {
    await admin.from("case_parties").insert(parties);
  }

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: caseRow.id,
    action: "case.created",
    entityType: "case",
    entityId: caseRow.id,
    metadata: {
      caseNumber: caseRow.case_number,
      totalAmount,
      currency: currency || "USD",
      escrowContractId: escrowRow?.id ?? null,
    },
  });

  revalidatePath("/dashboard/cases");
  revalidatePath("/dashboard/escrow");
  revalidatePath("/admin/cases");
  return ok({ caseId: caseRow.id, caseNumber: caseRow.case_number });
}

// ── updateCaseStatus ─────────────────────────────────────────────────────────

const updateCaseStatusSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(["draft", "active", "suspended", "closed", "under_dispute"]),
  reason: z.string().trim().max(2000).optional().default(""),
});

export interface UpdateCaseStatusInput {
  caseId: string;
  status: CaseStatus;
  reason?: string;
}

/**
 * Change a case's lifecycle status. Admin-only. Audited.
 */
export async function updateCaseStatus(
  input: UpdateCaseStatusInput
): Promise<ActionResult> {
  const parsed = updateCaseStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid status update.");
  }
  if (!CASE_STATUSES.includes(parsed.data.status)) {
    return fail("Unknown case status.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  const { supabase, profile } = ctx;
  requireAdmin(profile);

  const { error } = await supabase
    .from("cases")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.caseId);

  if (error) {
    return fail(error.message);
  }

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: parsed.data.caseId,
    action: "case.status_changed",
    entityType: "case",
    entityId: parsed.data.caseId,
    metadata: { status: parsed.data.status },
    reason: parsed.data.reason || null,
  });

  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  revalidatePath("/dashboard/escrow");
  revalidatePath("/admin/cases");
  return ok();
}

// ── assignParties ────────────────────────────────────────────────────────────

const assignPartiesSchema = z.object({
  caseId: z.string().min(1),
  partyAEmail: z.string().trim().email("Enter a valid client email."),
  partyBEmail: z.string().trim().email("Enter a valid operator email."),
});

export interface AssignPartiesInput {
  caseId: string;
  partyAEmail: string;
  partyBEmail: string;
}

/**
 * Assign / invite the two counterparties to a case. Admin-only. Links to an
 * existing profile by email when one exists; otherwise records an invitation.
 * Upserts on (case_id, party_role) so re-assigning replaces the prior invite.
 */
export async function assignParties(
  input: AssignPartiesInput
): Promise<ActionResult> {
  const parsed = assignPartiesSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid party emails.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  const { supabase, profile } = ctx;
  requireAdmin(profile);

  const { caseId, partyAEmail, partyBEmail } = parsed.data;

  // Resolve emails to existing profiles where possible (so access is immediate).
  const { data: matched } = await supabase
    .from("profiles")
    .select("id, email")
    .in("email", [partyAEmail, partyBEmail]);

  const idFor = (email: string): string | null =>
    matched?.find((m) => m.email?.toLowerCase() === email.toLowerCase())?.id ??
    null;

  const rows = [
    {
      case_id: caseId,
      party_role: "party_a" as PartyRole,
      invited_email: partyAEmail,
      profile_id: idFor(partyAEmail),
      accepted: Boolean(idFor(partyAEmail)),
    },
    {
      case_id: caseId,
      party_role: "party_b" as PartyRole,
      invited_email: partyBEmail,
      profile_id: idFor(partyBEmail),
      accepted: Boolean(idFor(partyBEmail)),
    },
  ];

  // Replace any existing party rows for these roles, then insert the new ones.
  await supabase
    .from("case_parties")
    .delete()
    .eq("case_id", caseId)
    .in("party_role", ["party_a", "party_b"]);

  const { error } = await supabase.from("case_parties").insert(rows);
  if (error) {
    return fail(error.message);
  }

  await logAudit(supabase, {
    actorId: profile.id,
    caseId,
    action: "case.parties_assigned",
    entityType: "case_parties",
    entityId: caseId,
    metadata: { partyAEmail, partyBEmail },
  });

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath("/dashboard/escrow");
  return ok();
}

// ── signContract ─────────────────────────────────────────────────────────────

const signContractSchema = z.object({
  caseId: z.string().min(1),
  party: z.enum(["party_a", "party_b"]),
});

export interface SignContractInput {
  caseId: string;
  party: "party_a" | "party_b";
}

/**
 * Record that a party has signed the case contract terms. The caller must be a
 * party on the case (or an admin). Sets contract_signed_by_a / _by_b. Audited.
 * This is NOT an approval to release funds — that is handled in approvals.ts.
 */
export async function signContract(
  input: SignContractInput
): Promise<ActionResult> {
  const parsed = signContractSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid signature request.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  const { supabase, profile } = ctx;

  const allowed = await userCanAccessCase(supabase, profile, parsed.data.caseId);
  if (!allowed) {
    return fail("You do not have access to this case.");
  }
  if (!isAdmin(profile)) {
    const partyRole = await partyRoleForUser(
      supabase,
      profile,
      parsed.data.caseId
    );
    if (partyRole !== parsed.data.party) {
      return fail("You can only sign for your assigned party role.");
    }
  }

  const column =
    parsed.data.party === "party_a"
      ? "contract_signed_by_a"
      : "contract_signed_by_b";

  const admin = createAdminClient();
  const { error } = await admin
    .from("cases")
    .update({ [column]: true, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.caseId);

  if (error) {
    return fail(error.message);
  }

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: parsed.data.caseId,
    action: "case.contract_signed",
    entityType: "case",
    entityId: parsed.data.caseId,
    metadata: { party: parsed.data.party },
  });

  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  revalidatePath("/dashboard/escrow");
  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  return ok();
}

// ── internal ─────────────────────────────────────────────────────────────────

/** Round to 2 decimals for display-only fee math. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

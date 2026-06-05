"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { DEMO_MODE } from "@/lib/constants";
import {
  fail,
  getAuthContext,
  ok,
  userCanAccessCase,
  type ActionResult,
} from "@/lib/actions/_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  KycReview,
  PayoutMethod,
  WithdrawalRequest,
} from "@/lib/types";

const caseIdSchema = z.string().trim().min(1, "Case id is required.");

const submitKycSchema = z.object({
  caseId: caseIdSchema,
  legalName: z.string().trim().min(2, "Enter your legal name.").max(120),
  phone: z.string().trim().min(6, "Enter a phone number.").max(40),
  governmentIdReference: z
    .string()
    .trim()
    .min(2, "Enter the government ID document reference.")
    .max(240),
  proofOfAddressReference: z
    .string()
    .trim()
    .min(2, "Enter the proof of address document reference.")
    .max(240),
  selfieConfirmed: z.boolean(),
});

const requestWithdrawalSchema = z.object({
  caseId: caseIdSchema,
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  currency: z.string().trim().min(3).max(8).default("USD"),
  method: z.enum(["bank_transfer", "card", "paypal"]),
  destinationLabel: z
    .string()
    .trim()
    .min(4, "Enter the transfer destination.")
    .max(240),
  note: z.string().trim().max(1000).optional().default(""),
});

function revalidateClientCase(caseId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cases");
  revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath("/dashboard/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/cases");
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function submitKycVerification(input: {
  caseId: string;
  legalName: string;
  phone: string;
  governmentIdReference: string;
  proofOfAddressReference: string;
  selfieConfirmed: boolean;
}): Promise<ActionResult<KycReview>> {
  const parsed = submitKycSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid KYC details.");
  }
  if (!parsed.data.selfieConfirmed) {
    return fail("Confirm that your selfie/liveness image is ready for review.");
  }

  if (DEMO_MODE) {
    return ok({
      id: "demo-kyc-review",
      case_id: parsed.data.caseId,
      profile_id: "demo-profile",
      status: "in_review",
      government_id_status: "submitted",
      selfie_status: "submitted",
      proof_of_address_status: "submitted",
      phone_verified: false,
      email_verified: true,
      reviewer_id: null,
      review_note: "Identity verification submitted and pending review.",
      updated_at: new Date().toISOString(),
    });
  }

  const ctx = await getAuthContext();
  if (!ctx) return fail("You must be signed in to submit KYC.");

  const allowed = await userCanAccessCase(
    ctx.supabase,
    ctx.profile,
    parsed.data.caseId
  );
  if (!allowed) return fail("You do not have access to this case.");

  const admin = createAdminClient();

  await admin
    .from("profiles")
    .update({
      full_name: parsed.data.legalName,
      phone: parsed.data.phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.profile.id);

  const { data, error } = await admin
    .from("recovery_kyc_reviews")
    .upsert(
      {
        case_id: parsed.data.caseId,
        profile_id: ctx.profile.id,
        status: "in_review",
        government_id_status: "submitted",
        selfie_status: "submitted",
        proof_of_address_status: "submitted",
        phone_verified: false,
        email_verified: true,
        reviewer_id: null,
        review_note: "Identity verification submitted and pending review.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id" }
    )
    .select("*")
    .single<KycReview>();

  if (error || !data) {
    return fail(error?.message ?? "Could not submit KYC verification.");
  }

  await logAudit(admin, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "recovery.kyc_submitted",
    entityType: "kyc_review",
    entityId: data.id,
    metadata: {
      government_id_reference: parsed.data.governmentIdReference,
      proof_of_address_reference: parsed.data.proofOfAddressReference,
      selfie_confirmed: true,
    },
    reason: "Client submitted identity verification documents.",
  });

  revalidateClientCase(parsed.data.caseId);
  return ok(data);
}

export async function requestEscrowWithdrawal(input: {
  caseId: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  destinationLabel: string;
  note?: string;
}): Promise<ActionResult<WithdrawalRequest>> {
  const parsed = requestWithdrawalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid transfer request.");
  }

  if (DEMO_MODE) {
    const providerFee = Math.round((parsed.data.amount * 0.015 + Number.EPSILON) * 100) / 100;
    const requestedAt = new Date().toISOString();
    return ok({
      id: "demo-withdrawal-request",
      user_id: "demo-profile",
      case_id: parsed.data.caseId,
      escrow_contract_id: null,
      profile_id: "demo-profile",
      amount: parsed.data.amount,
      currency: parsed.data.currency.toUpperCase(),
      provider_fee: providerFee,
      net_amount: Math.round((parsed.data.amount - providerFee + Number.EPSILON) * 100) / 100,
      method: parsed.data.method,
      withdrawal_method: parsed.data.method,
      provider: parsed.data.method === "card" ? "stripe" : parsed.data.method,
      provider_reference: null,
      destination_label: parsed.data.destinationLabel,
      status: "requested",
      admin_review_status: "pending_review",
      admin_notes: parsed.data.note || null,
      admin_note: parsed.data.note || null,
      submitted_at: requestedAt,
      requested_at: requestedAt,
      reviewed_by: null,
      reviewed_at: null,
      processed_at: null,
      completed_at: null,
      created_at: requestedAt,
      updated_at: requestedAt,
    });
  }

  const ctx = await getAuthContext();
  if (!ctx) return fail("You must be signed in to request a transfer.");

  const allowed = await userCanAccessCase(
    ctx.supabase,
    ctx.profile,
    parsed.data.caseId
  );
  if (!allowed) return fail("You do not have access to this case.");

  const [escrowResult, kycResult, conditionsResult, existingResult] =
    await Promise.all([
      ctx.supabase
        .from("escrow_contracts")
        .select("*")
        .eq("case_id", parsed.data.caseId)
        .maybeSingle<{
          id: string;
          net_release_amount: number | string;
          currency: string;
          release_status: string;
          escrow_status: string;
        }>(),
      ctx.supabase
        .from("recovery_kyc_reviews")
        .select("status")
        .eq("case_id", parsed.data.caseId)
        .maybeSingle<{ status: string }>(),
      ctx.supabase
        .from("withdrawal_conditions")
        .select("id")
        .eq("case_id", parsed.data.caseId)
        .eq("satisfied", false),
      ctx.supabase
        .from("withdrawal_requests")
        .select("id, status")
        .eq("case_id", parsed.data.caseId)
        .in("status", ["requested", "conditions_required", "approved"])
        .limit(1)
        .maybeSingle<{ id: string; status: string }>(),
    ]);

  const escrow = escrowResult.data;
  if (escrowResult.error || !escrow) {
    return fail("No escrow account exists for this case yet.");
  }
  if (kycResult.error || kycResult.data?.status !== "verified") {
    return fail("Complete KYC verification before requesting a transfer.");
  }
  if ((conditionsResult.data ?? []).length > 0) {
    return fail("Complete all release conditions before requesting a transfer.");
  }
  if (escrow.release_status !== "eligible") {
    return fail("Release authorization is required before transfer request.");
  }
  if (existingResult.data) {
    return fail("A transfer request is already in review for this case.");
  }

  const available = Number(escrow.net_release_amount ?? 0);
  const amount = Math.round((parsed.data.amount + Number.EPSILON) * 100) / 100;
  if (amount > available) {
    return fail("Requested amount is higher than the available withdrawal balance.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("withdrawal_requests")
    .insert({
      case_id: parsed.data.caseId,
      user_id: ctx.profile.id,
      escrow_contract_id: escrow.id,
      profile_id: ctx.profile.id,
      amount,
      currency: parsed.data.currency.toUpperCase(),
      provider_fee: Math.round((amount * 0.015 + Number.EPSILON) * 100) / 100,
      net_amount: Math.round((amount - amount * 0.015 + Number.EPSILON) * 100) / 100,
      method: parsed.data.method,
      withdrawal_method: parsed.data.method,
      provider: parsed.data.method === "card" ? "stripe" : parsed.data.method,
      provider_reference: null,
      destination_label: parsed.data.destinationLabel,
      status: "requested",
      admin_review_status: "pending_review",
      admin_notes: parsed.data.note || null,
      admin_note: parsed.data.note || null,
      submitted_at: new Date().toISOString(),
      requested_at: new Date().toISOString(),
    })
    .select("*")
    .single<WithdrawalRequest>();

  if (error || !data) {
    return fail(error?.message ?? "Could not request transfer.");
  }

  await admin
    .from("escrow_contracts")
    .update({
      release_status: "requested",
      updated_at: new Date().toISOString(),
    })
    .eq("id", escrow.id);

  await logAudit(admin, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "recovery.withdrawal_requested",
    entityType: "withdrawal_request",
    entityId: data.id,
    metadata: {
      amount,
      currency: data.currency,
      method: data.method,
    },
    reason: parsed.data.note || "Client requested escrow transfer.",
  });

  revalidateClientCase(parsed.data.caseId);
  return ok(data);
}

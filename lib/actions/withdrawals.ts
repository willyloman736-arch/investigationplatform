"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { notifyCaseClient } from "@/lib/notifications";
import { DEMO_MODE, PROVIDER_FEE_RATE } from "@/lib/constants";
import {
  fail,
  getAuthContext,
  ok,
  requireAdmin,
  userCanAccessCase,
  type ActionResult,
} from "@/lib/actions/_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import type { PayoutMethod, WithdrawalRequest, WithdrawalStatus } from "@/lib/types";

const ACTIVE_WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  "submitted",
  "pending_admin_review",
  "requested",
  "conditions_required",
  "approved",
  "approved_for_processing",
  "processing",
];

const withdrawalSchema = z.object({
  caseId: z.string().trim().min(1, "Case id is required."),
  escrowContractId: z.string().trim().min(1, "Escrow account is required."),
  amount: z.coerce.number().positive("Enter a withdrawal amount."),
  currency: z.string().trim().min(3).max(8).default("USD"),
  withdrawalMethod: z.enum(["bank_transfer", "card", "paypal"]),
  accountHolderName: z.string().trim().max(140).optional().default(""),
  bankName: z.string().trim().max(140).optional().default(""),
  routingNumber: z.string().trim().max(40).optional().default(""),
  accountNumber: z.string().trim().max(80).optional().default(""),
  accountType: z.string().trim().max(40).optional().default(""),
  billingCountry: z.string().trim().max(80).optional().default(""),
  cardholderName: z.string().trim().max(140).optional().default(""),
  billingPostalCode: z.string().trim().max(40).optional().default(""),
  paypalEmail: z.string().trim().email().optional().or(z.literal("")),
  confirmPaypalEmail: z.string().trim().email().optional().or(z.literal("")),
});

const reviewSchema = z.object({
  withdrawalId: z.string().trim().min(1, "Withdrawal id is required."),
  action: z.enum(["approve", "reject", "needs_more_information"]),
  note: z.string().trim().max(2000).optional().default(""),
});

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function last4(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-4) || "pending";
}

function providerFor(method: PayoutMethod): string {
  if (method === "card") return "stripe";
  if (method === "paypal") return "paypal";
  return "bank_partner";
}

function destinationLabel(data: z.infer<typeof withdrawalSchema>): string {
  if (data.withdrawalMethod === "bank_transfer") {
    return `${data.bankName || "Bank transfer"} ${
      data.accountType || "account"
    } ending ${last4(data.accountNumber)}`;
  }
  if (data.withdrawalMethod === "card") {
    return `Stripe card payout for ${data.cardholderName || "verified cardholder"}`;
  }
  return `PayPal ${data.paypalEmail}`;
}

function validateMethodDetails(data: z.infer<typeof withdrawalSchema>): string | null {
  if (data.withdrawalMethod === "bank_transfer") {
    if (!data.accountHolderName) return "Enter the account holder name.";
    if (!data.bankName) return "Enter the bank name.";
    if (!data.routingNumber) return "Enter the routing number.";
    if (!data.accountNumber) return "Enter the account number.";
    if (!data.accountType) return "Select the account type.";
    if (!data.billingCountry) return "Enter the billing country.";
  }

  if (data.withdrawalMethod === "card") {
    if (!data.cardholderName) return "Enter the cardholder name.";
    if (!data.billingPostalCode) return "Enter the billing ZIP or postal code.";
  }

  if (data.withdrawalMethod === "paypal") {
    if (!data.paypalEmail) return "Enter your PayPal email.";
    if (data.paypalEmail !== data.confirmPaypalEmail) {
      return "PayPal email confirmation does not match.";
    }
  }

  return null;
}

function revalidateWithdrawals(caseId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/withdraw");
  revalidatePath("/dashboard/cases");
  if (caseId) revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/withdrawals");
}

export async function submitWithdrawalRequest(input: {
  caseId: string;
  escrowContractId: string;
  amount: number;
  currency: string;
  withdrawalMethod: PayoutMethod;
  accountHolderName?: string;
  bankName?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: string;
  billingCountry?: string;
  cardholderName?: string;
  billingPostalCode?: string;
  paypalEmail?: string;
  confirmPaypalEmail?: string;
}): Promise<ActionResult<WithdrawalRequest>> {
  const parsed = withdrawalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid withdrawal request.");
  }

  const methodError = validateMethodDetails(parsed.data);
  if (methodError) return fail(methodError);

  const amount = round2(parsed.data.amount);
  const providerFee = round2(amount * PROVIDER_FEE_RATE);
  const netAmount = round2(Math.max(0, amount - providerFee));

  if (DEMO_MODE) {
    const request: WithdrawalRequest = {
      id: "demo-withdrawal-request",
      user_id: "demo-profile",
      case_id: parsed.data.caseId,
      escrow_contract_id: parsed.data.escrowContractId,
      profile_id: "demo-profile",
      amount,
      currency: parsed.data.currency.toUpperCase(),
      provider_fee: providerFee,
      net_amount: netAmount,
      method: parsed.data.withdrawalMethod,
      withdrawal_method: parsed.data.withdrawalMethod,
      provider: providerFor(parsed.data.withdrawalMethod),
      provider_reference: null,
      destination_label: destinationLabel(parsed.data),
      status: "pending_admin_review",
      admin_review_status: "pending_review",
      admin_notes: null,
      admin_note: null,
      submitted_at: nowIso(),
      requested_at: nowIso(),
      reviewed_by: null,
      reviewed_at: null,
      processed_at: null,
      completed_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    return ok(request);
  }

  const ctx = await getAuthContext();
  if (!ctx) return fail("You must be signed in to request a withdrawal.");

  if (!ctx.profile.is_verified) {
    return fail("Complete KYC verification before requesting withdrawal.");
  }

  const allowed = await userCanAccessCase(
    ctx.supabase,
    ctx.profile,
    parsed.data.caseId
  );
  if (!allowed) return fail("You do not have access to this escrow account.");

  const [escrowResult, disputesResult, conditionsResult, existingResult] =
    await Promise.all([
      ctx.supabase
        .from("escrow_contracts")
        .select("*")
        .eq("id", parsed.data.escrowContractId)
        .eq("case_id", parsed.data.caseId)
        .maybeSingle<{
          id: string;
          case_id: string;
          escrow_status: string;
          release_status: string;
          net_release_amount: number | string;
          currency: string;
        }>(),
      ctx.supabase
        .from("disputes")
        .select("id")
        .eq("case_id", parsed.data.caseId)
        .in("status", ["open", "under_review"]),
      ctx.supabase
        .from("withdrawal_conditions")
        .select("id")
        .eq("case_id", parsed.data.caseId)
        .eq("satisfied", false),
      ctx.supabase
        .from("withdrawal_requests")
        .select("id, status")
        .eq("case_id", parsed.data.caseId)
        .in("status", ACTIVE_WITHDRAWAL_STATUSES)
        .limit(1)
        .maybeSingle<{ id: string; status: WithdrawalStatus }>(),
    ]);

  const escrow = escrowResult.data;
  if (escrowResult.error || !escrow) {
    return fail("No eligible escrow account was found.");
  }

  const escrowReady =
    escrow.escrow_status === "ready_for_release" ||
    escrow.escrow_status === "release_approved";
  if (!escrowReady || escrow.release_status !== "eligible") {
    return fail("Withdrawal is currently unavailable while your case is under review.");
  }

  if ((disputesResult.data ?? []).length > 0 || escrow.escrow_status === "under_dispute_audit") {
    return fail("Withdrawal is currently unavailable while your case is under review.");
  }

  if ((conditionsResult.data ?? []).length > 0) {
    return fail("Complete all withdrawal conditions before submitting a request.");
  }

  if (existingResult.data) {
    return fail("A withdrawal request is already in review for this escrow account.");
  }

  const available = Number(escrow.net_release_amount ?? 0);
  if (available <= 0 || amount > available) {
    return fail("Requested amount exceeds the available withdrawal balance.");
  }

  const submittedAt = nowIso();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("withdrawal_requests")
    .insert({
      user_id: ctx.profile.id,
      profile_id: ctx.profile.id,
      case_id: parsed.data.caseId,
      escrow_contract_id: escrow.id,
      amount,
      currency: parsed.data.currency.toUpperCase(),
      provider_fee: providerFee,
      net_amount: netAmount,
      method: parsed.data.withdrawalMethod,
      withdrawal_method: parsed.data.withdrawalMethod,
      provider: providerFor(parsed.data.withdrawalMethod),
      provider_reference: null,
      destination_label: destinationLabel(parsed.data),
      status: "pending_admin_review",
      admin_review_status: "pending_review",
      admin_notes: null,
      admin_note: null,
      submitted_at: submittedAt,
      requested_at: submittedAt,
      reviewed_by: null,
      reviewed_at: null,
      processed_at: null,
      completed_at: null,
    })
    .select("*")
    .single<WithdrawalRequest>();

  if (error || !data) {
    return fail(error?.message ?? "Could not submit withdrawal request.");
  }

  await admin
    .from("escrow_contracts")
    .update({
      release_status: "requested",
      updated_at: submittedAt,
    })
    .eq("id", escrow.id);

  await logAudit(admin, {
    actorId: ctx.profile.id,
    caseId: parsed.data.caseId,
    action: "withdrawal.request_submitted",
    entityType: "withdrawal_request",
    entityId: data.id,
    metadata: {
      amount,
      currency: data.currency,
      provider_fee: providerFee,
      net_amount: netAmount,
      method: parsed.data.withdrawalMethod,
      provider: data.provider,
    },
    reason: "Client submitted withdrawal request for admin/provider review.",
  });

  revalidateWithdrawals(parsed.data.caseId);
  return ok(data);
}

export async function reviewWithdrawalProcessingRequest(input: {
  withdrawalId: string;
  action: "approve" | "reject" | "needs_more_information";
  note?: string;
}): Promise<ActionResult<WithdrawalRequest>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid review request.");
  }

  if (
    (parsed.data.action === "reject" ||
      parsed.data.action === "needs_more_information") &&
    !parsed.data.note.trim()
  ) {
    return fail("A reason note is required for this review action.");
  }

  if (DEMO_MODE) {
    return ok({
      id: parsed.data.withdrawalId,
      user_id: "demo-profile",
      case_id: "demo-case",
      escrow_contract_id: "demo-escrow",
      profile_id: "demo-profile",
      amount: 1000,
      currency: "USD",
      provider_fee: 15,
      net_amount: 985,
      method: "bank_transfer",
      withdrawal_method: "bank_transfer",
      provider: "bank_partner",
      provider_reference: null,
      destination_label: "Demo bank account",
      status:
        parsed.data.action === "approve"
          ? "approved_for_processing"
          : parsed.data.action === "reject"
          ? "rejected"
          : "pending_admin_review",
      admin_review_status:
        parsed.data.action === "approve"
          ? "approved"
          : parsed.data.action === "reject"
          ? "rejected"
          : "needs_more_information",
      admin_notes: parsed.data.note || null,
      admin_note: parsed.data.note || null,
      submitted_at: nowIso(),
      requested_at: nowIso(),
      reviewed_by: "demo-admin",
      reviewed_at: nowIso(),
      processed_at: null,
      completed_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  const ctx = await getAuthContext();
  if (!ctx) return fail("You must be signed in as an administrator.");
  requireAdmin(ctx.profile);

  const admin = createAdminClient();
  const { data: current, error: loadError } = await admin
    .from("withdrawal_requests")
    .select("*")
    .eq("id", parsed.data.withdrawalId)
    .maybeSingle<WithdrawalRequest>();

  if (loadError || !current) {
    return fail(loadError?.message ?? "Withdrawal request not found.");
  }

  const status: WithdrawalStatus =
    parsed.data.action === "approve"
      ? "approved_for_processing"
      : parsed.data.action === "reject"
      ? "rejected"
      : "pending_admin_review";
  const adminReviewStatus =
    parsed.data.action === "approve"
      ? "approved"
      : parsed.data.action === "reject"
      ? "rejected"
      : "needs_more_information";
  const reviewedAt = nowIso();

  const { data: updated, error } = await admin
    .from("withdrawal_requests")
    .update({
      status,
      admin_review_status: adminReviewStatus,
      admin_notes: parsed.data.note || null,
      admin_note: parsed.data.note || null,
      reviewed_by: ctx.profile.id,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", current.id)
    .select("*")
    .single<WithdrawalRequest>();

  if (error || !updated) {
    return fail(error?.message ?? "Could not update withdrawal request.");
  }

  await logAudit(admin, {
    actorId: ctx.profile.id,
    caseId: current.case_id,
    action: "withdrawal.admin_reviewed",
    entityType: "withdrawal_request",
    entityId: current.id,
    metadata: {
      status,
      admin_review_status: adminReviewStatus,
      provider: current.provider,
    },
    reason: parsed.data.note || "Withdrawal approved for provider processing.",
  });

  await notifyCaseClient({
    caseId: current.case_id,
    actorId: ctx.profile.id,
    type:
      parsed.data.action === "approve"
        ? "withdrawal_approved"
        : parsed.data.action === "reject"
        ? "withdrawal_denied"
        : "withdrawal_conditions",
    title:
      parsed.data.action === "approve"
        ? "Withdrawal approved for processing"
        : parsed.data.action === "reject"
        ? "Withdrawal request rejected"
        : "More information needed",
    body:
      parsed.data.action === "approve"
        ? "Your withdrawal request was approved for secure provider processing."
        : parsed.data.note || "Please review the latest withdrawal request note.",
    link: "/dashboard/withdraw",
  });

  revalidateWithdrawals(current.case_id);
  return ok(updated);
}

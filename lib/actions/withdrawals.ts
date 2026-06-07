"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { notifyCaseClient } from "@/lib/notifications";
import {
  DEMO_MODE,
  RELEASE_PROCESSING_FEE_PERCENTAGE,
  RELEASE_PROCESSING_FEE_RATE,
} from "@/lib/constants";
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
  "pending_review",
  "awaiting_fee_completion",
  "pending_admin_review",
  "requested",
  "conditions_required",
  "approved",
  "approved_for_processing",
  "processing",
];

const sensitivePaymentKeys = new Set([
  "accountNumber",
  "confirmAccountNumber",
  "cardNumber",
  "cvv",
]);

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
  cardPaymentMethodId: z.string().trim().max(120).optional().default(""),
  paypalEmail: z.string().trim().email().optional().or(z.literal("")),
  confirmPaypalEmail: z.string().trim().email().optional().or(z.literal("")),
  paymentDetails: z.record(z.unknown()).optional().default({}),
});

const reviewSchema = z.object({
  withdrawalId: z.string().trim().min(1, "Withdrawal id is required."),
  action: z.enum([
    "approve",
    "verify_fee",
    "mark_processing",
    "mark_completed",
    "reject",
    "needs_more_information",
  ]),
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

function sanitizePaymentDetails(
  method: PayoutMethod,
  details: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { method };
  for (const [key, value] of Object.entries(details)) {
    if (typeof value !== "string") {
      sanitized[key] = value;
      continue;
    }

    if (key === "accountNumber") {
      sanitized.accountLast4 = last4(value);
      continue;
    }
    if (key === "cardNumber") {
      sanitized.cardLast4 = last4(value);
      sanitized.cardBrand = value.trim().startsWith("4")
        ? "Visa"
        : "Mastercard";
      continue;
    }
    if (sensitivePaymentKeys.has(key)) continue;
    sanitized[key] = value.trim();
  }
  return sanitized;
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
    if (!data.cardPaymentMethodId) return "Secure the card with Stripe before submitting.";
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
  revalidatePath("/dashboard/escrow");
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
  cardPaymentMethodId?: string;
  paypalEmail?: string;
  confirmPaypalEmail?: string;
  paymentDetails?: Record<string, unknown>;
}): Promise<ActionResult<WithdrawalRequest>> {
  const parsed = withdrawalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid withdrawal request.");
  }

  const methodError = validateMethodDetails(parsed.data);
  if (methodError) return fail(methodError);

  const amount = round2(parsed.data.amount);
  const releaseProcessingFee = round2(amount * RELEASE_PROCESSING_FEE_RATE);
  const netAmount = round2(Math.max(0, amount - releaseProcessingFee));
  const paymentDetails = sanitizePaymentDetails(
    parsed.data.withdrawalMethod,
    parsed.data.paymentDetails
  );

  if (DEMO_MODE) {
    const request: WithdrawalRequest = {
      id: "demo-withdrawal-request",
      user_id: "demo-profile",
      case_id: parsed.data.caseId,
      escrow_contract_id: parsed.data.escrowContractId,
      profile_id: "demo-profile",
      amount,
      currency: parsed.data.currency.toUpperCase(),
      provider_fee: 0,
      release_processing_fee: releaseProcessingFee,
      release_processing_fee_percentage: RELEASE_PROCESSING_FEE_PERCENTAGE,
      net_amount: netAmount,
      method: parsed.data.withdrawalMethod,
      withdrawal_method: parsed.data.withdrawalMethod,
      provider: providerFor(parsed.data.withdrawalMethod),
      provider_reference:
        parsed.data.withdrawalMethod === "card"
          ? parsed.data.cardPaymentMethodId
          : null,
      destination_label: destinationLabel(parsed.data),
      status: "awaiting_fee_completion",
      fee_status: "pending_verification",
      payment_details: paymentDetails,
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
      provider_fee: 0,
      release_processing_fee: releaseProcessingFee,
      release_processing_fee_percentage: RELEASE_PROCESSING_FEE_PERCENTAGE,
      net_amount: netAmount,
      method: parsed.data.withdrawalMethod,
      withdrawal_method: parsed.data.withdrawalMethod,
      provider: providerFor(parsed.data.withdrawalMethod),
      provider_reference:
        parsed.data.withdrawalMethod === "card"
          ? parsed.data.cardPaymentMethodId
          : null,
      destination_label: destinationLabel(parsed.data),
      status: "awaiting_fee_completion",
      fee_status: "pending_verification",
      payment_details: paymentDetails,
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
      release_processing_fee: releaseProcessingFee,
      release_processing_fee_percentage: RELEASE_PROCESSING_FEE_PERCENTAGE,
      net_amount: netAmount,
      method: parsed.data.withdrawalMethod,
      provider: data.provider,
      provider_reference: data.provider_reference,
      fee_status: data.fee_status,
    },
    reason: "Client submitted withdrawal request pending release fee verification.",
  });

  revalidateWithdrawals(parsed.data.caseId);
  return ok(data);
}

export async function reviewWithdrawalProcessingRequest(input: {
  withdrawalId: string;
  action:
    | "approve"
    | "verify_fee"
    | "mark_processing"
    | "mark_completed"
    | "reject"
    | "needs_more_information";
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
      provider_fee: 0,
      release_processing_fee: 200,
      release_processing_fee_percentage: 20,
      net_amount: 800,
      method: "bank_transfer",
      withdrawal_method: "bank_transfer",
      provider: "bank_partner",
      provider_reference: null,
      destination_label: "Demo bank account",
      status:
        parsed.data.action === "verify_fee" || parsed.data.action === "mark_processing"
          ? "processing"
          : parsed.data.action === "mark_completed"
          ? "completed"
          : parsed.data.action === "approve"
          ? "awaiting_fee_completion"
          : parsed.data.action === "reject"
          ? "rejected"
          : "pending_review",
      fee_status:
        parsed.data.action === "verify_fee" ||
        parsed.data.action === "mark_processing" ||
        parsed.data.action === "mark_completed"
          ? "completed"
          : "pending_verification",
      payment_details: {},
      admin_review_status:
        parsed.data.action === "approve" ||
        parsed.data.action === "verify_fee" ||
        parsed.data.action === "mark_processing" ||
        parsed.data.action === "mark_completed"
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

  const reviewedAt = nowIso();
  const feeCompleted =
    current.fee_status === "completed" ||
    parsed.data.action === "verify_fee" ||
    parsed.data.action === "mark_processing" ||
    parsed.data.action === "mark_completed";

  if (
    (parsed.data.action === "mark_processing" ||
      parsed.data.action === "mark_completed") &&
    !feeCompleted
  ) {
    return fail("Release processing fee must be verified before payout processing.");
  }

  const patch: Partial<WithdrawalRequest> & {
    updated_at: string;
    fee_status?: "unpaid" | "pending_verification" | "completed";
  } = {
    updated_at: reviewedAt,
  };

  if (parsed.data.action === "approve") {
    patch.status = feeCompleted ? "processing" : "awaiting_fee_completion";
    patch.admin_review_status = "approved";
    patch.reviewed_by = ctx.profile.id;
    patch.reviewed_at = reviewedAt;
    if (feeCompleted) patch.processed_at = reviewedAt;
  } else if (parsed.data.action === "verify_fee") {
    patch.fee_status = "completed";
    patch.status = "processing";
    patch.admin_review_status = "approved";
    patch.reviewed_by = ctx.profile.id;
    patch.reviewed_at = reviewedAt;
    patch.processed_at = reviewedAt;
  } else if (parsed.data.action === "mark_processing") {
    patch.status = "processing";
    patch.processed_at = reviewedAt;
  } else if (parsed.data.action === "mark_completed") {
    patch.fee_status = "completed";
    patch.status = "completed";
    patch.completed_at = reviewedAt;
  } else if (parsed.data.action === "reject") {
    patch.status = "rejected";
    patch.admin_review_status = "rejected";
    patch.reviewed_by = ctx.profile.id;
    patch.reviewed_at = reviewedAt;
  } else {
    patch.status = "pending_review";
    patch.admin_review_status = "needs_more_information";
    patch.reviewed_by = ctx.profile.id;
    patch.reviewed_at = reviewedAt;
  }

  const { data: updated, error } = await admin
    .from("withdrawal_requests")
    .update({
      ...patch,
      admin_notes: parsed.data.note || null,
      admin_note: parsed.data.note || null,
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
      status: updated.status,
      fee_status: updated.fee_status,
      admin_review_status: updated.admin_review_status,
      provider: current.provider,
      release_processing_fee: updated.release_processing_fee,
    },
    reason: parsed.data.note || "Withdrawal payout state updated.",
  });

  await notifyCaseClient({
    caseId: current.case_id,
    actorId: ctx.profile.id,
    type:
      parsed.data.action === "approve" ||
      parsed.data.action === "verify_fee" ||
      parsed.data.action === "mark_processing" ||
      parsed.data.action === "mark_completed"
        ? "withdrawal_approved"
      : parsed.data.action === "reject"
        ? "withdrawal_denied"
        : "withdrawal_conditions",
    title:
      parsed.data.action === "verify_fee" || parsed.data.action === "mark_processing"
        ? "Withdrawal processing scheduled"
        : parsed.data.action === "mark_completed"
        ? "Withdrawal completed"
        : parsed.data.action === "approve"
        ? "Withdrawal request approved"
        : parsed.data.action === "reject"
        ? "Withdrawal request rejected"
        : "More information needed",
    body:
      parsed.data.action === "verify_fee" || parsed.data.action === "mark_processing"
        ? "Your release processing requirements were verified and your payout has been scheduled for processing."
        : parsed.data.action === "mark_completed"
        ? "Your payout status has been marked completed."
        : parsed.data.action === "approve"
        ? "Your withdrawal request was approved and is awaiting release fee verification."
        : parsed.data.note || "Please review the latest withdrawal request note.",
    link: "/dashboard/withdraw",
  });

  revalidateWithdrawals(current.case_id);
  return ok(updated);
}

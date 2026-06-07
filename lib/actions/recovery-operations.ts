"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { notifyCaseClient } from "@/lib/notifications";
import {
  DEMO_MODE,
  PLATFORM_FEE_RATE,
  PROVIDER_FEE_RATE,
} from "@/lib/constants";
import type {
  EscrowContract,
  EmailLog,
  KycReview,
  KycStatus,
  NotificationType,
  RecoveredFundsEntry,
  RecoveryReceipt,
  RecoveryReceiptKind,
  WithdrawalCondition,
  WithdrawalConditionGate,
  WithdrawalRequest,
  WithdrawalStatus,
} from "@/lib/types";
import {
  fail,
  getAuthContext,
  ok,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions/_helpers";

const caseIdSchema = z.string().trim().min(1, "Case id is required.");
const noteSchema = z.string().trim().min(1, "A reason note is required.");

const updateKycSchema = z.object({
  caseId: caseIdSchema,
  status: z.enum([
    "not_started",
    "in_review",
    "pending_review",
    "verified",
    "rejected",
    "declined",
    "resubmission_required",
  ]),
  note: noteSchema,
});

const recordRecoveredFundsSchema = z.object({
  caseId: caseIdSchema,
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  currency: z.string().trim().min(3).max(8).default("USD"),
  sourceLabel: z.string().trim().min(1, "Source label is required."),
  providerReference: z.string().trim().optional(),
  notes: noteSchema,
});

const addWithdrawalConditionSchema = z.object({
  caseId: caseIdSchema,
  label: z.string().trim().min(1, "Condition label is required."),
  description: z.string().trim().min(1, "Condition details are required."),
  gate: z.enum(["before_request", "before_approval", "before_payout"]),
});

const reviewWithdrawalSchema = z.object({
  caseId: caseIdSchema,
  status: z.enum(["conditions_required", "approved", "denied", "paid_out"]),
  note: noteSchema,
});

const generateReceiptSchema = z.object({
  caseId: caseIdSchema,
  kind: z.enum([
    "case_update",
    "recovered_funds",
    "withdrawal_condition",
    "withdrawal_approval",
    "withdrawal_paid",
  ]),
  title: z.string().trim().min(1, "Receipt title is required."),
  amount: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().min(3).max(8).default("USD"),
  recipientEmail: z.string().trim().email("Enter a valid recipient email."),
  notes: noteSchema,
});

const sendReceiptEmailSchema = z.object({
  caseId: caseIdSchema,
  receiptId: z.string().trim().min(1, "Receipt id is required."),
  recipientEmail: z.string().trim().email("Enter a valid recipient email."),
  subject: z.string().trim().min(1, "Email subject is required."),
});

async function adminOrDemo(): Promise<Awaited<ReturnType<typeof getAuthContext>>> {
  if (DEMO_MODE) return null;

  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error("You must be signed in as an administrator.");
  }
  requireAdmin(ctx.profile);
  return ctx;
}

function makeId(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  return `${prefix}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function receiptNumber(): string {
  const year = new Date().getUTCFullYear();
  const suffix = makeId("rcpt").slice(-8).toUpperCase();
  return `RCPT-${year}-${suffix}`;
}

function demoPreviewReceiptId(
  receipt: Omit<RecoveryReceipt, "id">
): string {
  const payload = Buffer.from(JSON.stringify(receipt), "utf8").toString(
    "base64url"
  );
  return `preview-${payload}`;
}

function revalidateCase(caseId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/cases");
  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/escrow");
  revalidatePath("/dashboard/cases");
  revalidatePath(`/dashboard/cases/${caseId}`);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function asAmount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function kycDocumentPatch(status: KycStatus) {
  if (status === "verified") {
    return {
      government_id_status: "verified" as const,
      selfie_status: "verified" as const,
      proof_of_address_status: "verified" as const,
      phone_verified: true,
      email_verified: true,
    };
  }

  if (
    status === "rejected" ||
    status === "declined" ||
    status === "resubmission_required"
  ) {
    return {
      government_id_status: "rejected" as const,
      selfie_status: "rejected" as const,
      proof_of_address_status: "rejected" as const,
      phone_verified: false,
      email_verified: false,
    };
  }

  if (status === "in_review" || status === "pending_review") {
    return {
      government_id_status: "submitted" as const,
      selfie_status: "submitted" as const,
      proof_of_address_status: "submitted" as const,
      phone_verified: false,
      email_verified: false,
    };
  }

  return {
    government_id_status: "not_submitted" as const,
    selfie_status: "not_submitted" as const,
    proof_of_address_status: "not_submitted" as const,
    phone_verified: false,
    email_verified: false,
  };
}

async function getCaseOwnerId(
  client: SupabaseClient,
  caseId: string
): Promise<string> {
  const { data, error } = await client
    .from("cases")
    .select("created_by")
    .eq("id", caseId)
    .maybeSingle<{ created_by: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "Case not found.");
  }

  return data.created_by;
}

async function loadEscrow(
  client: SupabaseClient,
  caseId: string
): Promise<EscrowContract | null> {
  const { data, error } = await client
    .from("escrow_contracts")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle<EscrowContract>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function syncEscrowFromRecoveredFunds(
  client: SupabaseClient,
  {
    caseId,
    currency,
    providerReference,
  }: {
    caseId: string;
    currency: string;
    providerReference?: string | null;
  }
): Promise<EscrowContract> {
  const existing = await loadEscrow(client, caseId);
  const { data: entries, error } = await client
    .from("recovered_funds_entries")
    .select("amount")
    .eq("case_id", caseId)
    .eq("visible_to_client", true);

  if (error) {
    throw new Error(error.message);
  }

  const totalAmount = round2(
    (entries ?? []).reduce((sum, entry) => sum + asAmount(entry.amount), 0)
  );
  const platformFee = round2(totalAmount * PLATFORM_FEE_RATE);
  const providerFee = round2(totalAmount * PROVIDER_FEE_RATE);
  const netReleaseAmount = round2(
    Math.max(0, totalAmount - platformFee - providerFee)
  );
  const preservedWorkflowStatus = existing?.escrow_status;
  const escrowStatus =
    totalAmount <= 0
      ? "pending_deposit"
      : preservedWorkflowStatus &&
        [
          "under_dispute_audit",
          "ready_for_release",
          "release_approved",
          "release_frozen",
          "released",
        ].includes(preservedWorkflowStatus)
      ? preservedWorkflowStatus
      : "securely_escrowed";
  const releaseStatus =
    existing?.release_status === "completed" ||
    existing?.release_status === "eligible"
      ? existing.release_status
      : "not_started";

  const { data, error: upsertError } = await client
    .from("escrow_contracts")
    .upsert(
      {
        case_id: caseId,
        currency,
        total_amount: totalAmount,
        platform_fee: platformFee,
        provider_fee: providerFee,
        net_release_amount: netReleaseAmount,
        escrow_status: escrowStatus,
        deposit_status: totalAmount > 0 ? "received" : "awaiting",
        release_status: releaseStatus,
        provider_reference:
          providerReference ?? existing?.provider_reference ?? null,
        updated_at: nowIso(),
      },
      { onConflict: "case_id" }
    )
    .select("*")
    .single<EscrowContract>();

  if (upsertError || !data) {
    throw new Error(upsertError?.message ?? "Could not sync escrow balance.");
  }

  return data;
}

async function updateEscrowForWithdrawalReview(
  client: SupabaseClient,
  caseId: string,
  status: Extract<
    WithdrawalStatus,
    "conditions_required" | "approved" | "denied" | "paid_out"
  >,
  note: string
): Promise<EscrowContract | null> {
  const escrow = await loadEscrow(client, caseId);
  if (!escrow) return null;

  const patch =
    status === "approved"
      ? {
          escrow_status: "ready_for_release" as const,
          release_status: "eligible" as const,
          release_eligibility_reason: note,
        }
      : status === "paid_out"
      ? {
          escrow_status: "released" as const,
          release_status: "completed" as const,
          release_eligibility_reason: note,
        }
      : {
          escrow_status: "release_frozen" as const,
          release_status: "not_started" as const,
          release_eligibility_reason: note,
        };

  const { data, error } = await client
    .from("escrow_contracts")
    .update({
      ...patch,
      updated_at: nowIso(),
    })
    .eq("id", escrow.id)
    .select("*")
    .single<EscrowContract>();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update escrow status.");
  }

  return data;
}

function kycNotification(
  status: KycStatus
): { type: NotificationType; title: string; body: string } | null {
  switch (status) {
    case "verified":
      return {
        type: "kyc_verified",
        title: "Identity verified",
        body: "Your KYC verification was approved. Your recovery case can now proceed.",
      };
    case "rejected":
    case "declined":
      return {
        type: "kyc_declined",
        title: "KYC verification declined",
        body: "Your identity verification was not approved. Please review the reviewer notes.",
      };
    case "resubmission_required":
      return {
        type: "kyc_resubmission",
        title: "KYC resubmission needed",
        body: "We need clearer or additional documents to verify your identity. Please resubmit.",
      };
    default:
      return null;
  }
}

function withdrawalNotification(
  status: Extract<
    WithdrawalStatus,
    "conditions_required" | "approved" | "denied" | "paid_out"
  >
): { type: NotificationType; title: string; body: string } {
  switch (status) {
    case "approved":
      return {
        type: "withdrawal_approved",
        title: "Withdrawal approved",
        body: "Your withdrawal request was approved and your funds are ready for release.",
      };
    case "denied":
      return {
        type: "withdrawal_denied",
        title: "Withdrawal not approved",
        body: "Your withdrawal request was not approved. Please review the notes for details.",
      };
    case "paid_out":
      return {
        type: "withdrawal_paid",
        title: "Funds released",
        body: "Your recovered funds have been released. A payout receipt is available on your case.",
      };
    case "conditions_required":
    default:
      return {
        type: "withdrawal_conditions",
        title: "Withdrawal conditions required",
        body: "Some conditions must be met before your withdrawal can proceed.",
      };
  }
}

export async function updateKycReview(input: {
  caseId: string;
  status: KycStatus;
  note: string;
}): Promise<ActionResult<Partial<KycReview>>> {
  const parsed = updateKycSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid KYC update.");
  }

  try {
    const ctx = await adminOrDemo();
    if (ctx) {
      const profileId = await getCaseOwnerId(ctx.supabase, parsed.data.caseId);
      const { data: review, error } = await ctx.supabase
        .from("recovery_kyc_reviews")
        .upsert(
          {
            case_id: parsed.data.caseId,
            profile_id: profileId,
            status: parsed.data.status,
            ...kycDocumentPatch(parsed.data.status),
            reviewer_id: ctx.profile.id,
            review_note: parsed.data.note,
            updated_at: nowIso(),
          },
          { onConflict: "case_id" }
        )
        .select("*")
        .single<KycReview>();

      if (error || !review) {
        return fail(error?.message ?? "Could not update KYC.");
      }

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.kyc_status_updated",
        entityType: "kyc_review",
        entityId: review.id,
        metadata: { status: parsed.data.status },
        reason: parsed.data.note,
      });

      const kycNotice = kycNotification(parsed.data.status);
      if (kycNotice) {
        await notifyCaseClient({
          caseId: parsed.data.caseId,
          actorId: ctx.profile.id,
          type: kycNotice.type,
          title: kycNotice.title,
          body: kycNotice.body,
          link: "/dashboard/kyc",
        });
      }

      revalidateCase(parsed.data.caseId);
      return ok(review);
    }

    revalidateCase(parsed.data.caseId);
    return ok({
      status: parsed.data.status,
      review_note: parsed.data.note,
      reviewer_id: null,
      updated_at: nowIso(),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not update KYC.");
  }
}

export async function recordRecoveredFunds(input: {
  caseId: string;
  amount: number;
  currency: string;
  sourceLabel: string;
  providerReference?: string;
  notes: string;
}): Promise<ActionResult<RecoveredFundsEntry>> {
  const parsed = recordRecoveredFundsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid funds entry.");
  }

  try {
    const ctx = await adminOrDemo();
    const entryDraft = {
      case_id: parsed.data.caseId,
      amount: round2(parsed.data.amount),
      currency: parsed.data.currency.toUpperCase(),
      source_label: parsed.data.sourceLabel,
      provider_reference: parsed.data.providerReference?.trim() || null,
      visible_to_client: true,
      entered_by: ctx?.profile.id ?? "demo-admin",
      notes: parsed.data.notes,
      created_at: nowIso(),
    };

    if (ctx) {
      const { data: entry, error } = await ctx.supabase
        .from("recovered_funds_entries")
        .insert(entryDraft)
        .select("*")
        .single<RecoveredFundsEntry>();

      if (error || !entry) {
        return fail(error?.message ?? "Could not record recovered funds.");
      }

      const escrow = await syncEscrowFromRecoveredFunds(ctx.supabase, {
        caseId: parsed.data.caseId,
        currency: entry.currency,
        providerReference: entry.provider_reference,
      });

      const { error: txnError } = await ctx.supabase
        .from("escrow_transactions")
        .insert({
          escrow_contract_id: escrow.id,
          case_id: parsed.data.caseId,
          type: "deposit",
          amount: entry.amount,
          currency: entry.currency,
          provider_reference: entry.provider_reference,
          provider_status: "recovered_funds_recorded",
          status: "confirmed",
          initiated_by: ctx.profile.id,
          notes: parsed.data.notes,
        });

      if (txnError) {
        return fail(txnError.message);
      }

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.recovered_funds_recorded",
        entityType: "recovered_funds_entry",
        entityId: entry.id,
        metadata: {
          amount: entry.amount,
          currency: entry.currency,
          visible_to_client: true,
        },
        reason: parsed.data.notes,
      });

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "escrow.balance_synced",
        entityType: "escrow_contract",
        entityId: escrow.id,
        metadata: {
          total_amount: escrow.total_amount,
          currency: escrow.currency,
          deposit_status: escrow.deposit_status,
          escrow_status: escrow.escrow_status,
        },
        reason: parsed.data.notes,
      });

      await notifyCaseClient({
        caseId: parsed.data.caseId,
        actorId: ctx.profile.id,
        type: "recovered_funds",
        title: "Recovered funds recorded",
        body: `${entry.currency} ${entry.amount.toLocaleString()} in recovered funds was added to your secure escrow record.`,
        link: "/dashboard/cases",
        metadata: { amount: entry.amount, currency: entry.currency },
      });

      revalidateCase(parsed.data.caseId);
      return ok(entry);
    }

    const entry: RecoveredFundsEntry = {
      id: makeId("recovered"),
      ...entryDraft,
    };
    revalidateCase(parsed.data.caseId);
    return ok(entry);
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not record recovered funds."
    );
  }
}

export async function addWithdrawalCondition(input: {
  caseId: string;
  label: string;
  description: string;
  gate: WithdrawalConditionGate;
}): Promise<ActionResult<WithdrawalCondition>> {
  const parsed = addWithdrawalConditionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid condition.");
  }

  try {
    const ctx = await adminOrDemo();
    const conditionDraft = {
      case_id: parsed.data.caseId,
      label: parsed.data.label,
      description: parsed.data.description,
      gate: parsed.data.gate,
      satisfied: false,
      created_by: ctx?.profile.id ?? "demo-admin",
      created_at: nowIso(),
      resolved_at: null,
    };

    if (ctx) {
      const { data: condition, error } = await ctx.supabase
        .from("withdrawal_conditions")
        .insert(conditionDraft)
        .select("*")
        .single<WithdrawalCondition>();

      if (error || !condition) {
        return fail(error?.message ?? "Could not add withdrawal condition.");
      }

      await updateEscrowForWithdrawalReview(
        ctx.supabase,
        parsed.data.caseId,
        "conditions_required",
        condition.description
      );

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.withdrawal_condition_added",
        entityType: "withdrawal_condition",
        entityId: condition.id,
        metadata: { gate: condition.gate, label: condition.label },
        reason: condition.description,
      });

      await notifyCaseClient({
        caseId: parsed.data.caseId,
        actorId: ctx.profile.id,
        type: "withdrawal_conditions",
        title: "Action needed before withdrawal",
        body: `A new condition was added to your case: ${condition.label}. Complete it to proceed with your withdrawal.`,
        link: "/dashboard/cases",
      });

      revalidateCase(parsed.data.caseId);
      return ok(condition);
    }

    const condition: WithdrawalCondition = {
      id: makeId("condition"),
      ...conditionDraft,
    };
    revalidateCase(parsed.data.caseId);
    return ok(condition);
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not add withdrawal condition."
    );
  }
}

const satisfyConditionSchema = z.object({
  caseId: caseIdSchema,
  conditionId: z.string().trim().min(1, "Condition id is required."),
  satisfied: z.boolean().optional().default(true),
});

/**
 * Mark a release/withdrawal condition as satisfied (or reopen it). Admin-only,
 * audited, and notifies the client when a requirement is cleared. This is the
 * missing counterpart to addWithdrawalCondition — without it, a pending
 * condition blocks the client's withdrawal permanently.
 */
export async function setWithdrawalConditionSatisfied(input: {
  caseId: string;
  conditionId: string;
  satisfied?: boolean;
}): Promise<ActionResult<Partial<WithdrawalCondition>>> {
  const parsed = satisfyConditionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid condition update.");
  }

  try {
    const ctx = await adminOrDemo();
    if (ctx) {
      const { data: condition, error } = await ctx.supabase
        .from("withdrawal_conditions")
        .update({
          satisfied: parsed.data.satisfied,
          resolved_at: parsed.data.satisfied ? nowIso() : null,
        })
        .eq("id", parsed.data.conditionId)
        .eq("case_id", parsed.data.caseId)
        .select("*")
        .single<WithdrawalCondition>();

      if (error || !condition) {
        return fail(error?.message ?? "Could not update the condition.");
      }

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: parsed.data.satisfied
          ? "recovery.withdrawal_condition_satisfied"
          : "recovery.withdrawal_condition_reopened",
        entityType: "withdrawal_condition",
        entityId: condition.id,
        metadata: { label: condition.label, satisfied: condition.satisfied },
      });

      if (parsed.data.satisfied) {
        await notifyCaseClient({
          caseId: parsed.data.caseId,
          actorId: ctx.profile.id,
          type: "withdrawal_conditions",
          title: "Release requirement completed",
          body: `A release requirement on your case was marked satisfied: ${condition.label}.`,
          link: "/dashboard/cases",
        });
      }

      revalidateCase(parsed.data.caseId);
      return ok(condition);
    }

    revalidateCase(parsed.data.caseId);
    return ok({ id: parsed.data.conditionId, satisfied: parsed.data.satisfied });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not update the condition."
    );
  }
}

export async function reviewWithdrawalRequest(input: {
  caseId: string;
  status: Extract<
    WithdrawalStatus,
    "conditions_required" | "approved" | "denied" | "paid_out"
  >;
  note: string;
}): Promise<ActionResult<Partial<WithdrawalRequest>>> {
  const parsed = reviewWithdrawalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid withdrawal review.");
  }

  try {
    const ctx = await adminOrDemo();
    if (ctx) {
      const { data: current, error: loadError } = await ctx.supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("case_id", parsed.data.caseId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle<WithdrawalRequest>();

      if (loadError) {
        return fail(loadError.message);
      }
      if (!current) {
        return fail("No withdrawal request exists for this case yet.");
      }

      const { data: updated, error } = await ctx.supabase
        .from("withdrawal_requests")
        .update({
          status: parsed.data.status,
          admin_note: parsed.data.note,
          reviewed_by: ctx.profile.id,
          reviewed_at: nowIso(),
        })
        .eq("id", current.id)
        .select("*")
        .single<WithdrawalRequest>();

      if (error || !updated) {
        return fail(error?.message ?? "Could not review withdrawal.");
      }

      const escrow = await updateEscrowForWithdrawalReview(
        ctx.supabase,
        parsed.data.caseId,
        parsed.data.status,
        parsed.data.note
      );

      if (parsed.data.status === "paid_out" && escrow) {
        const { error: releaseTxnError } = await ctx.supabase
          .from("escrow_transactions")
          .insert({
            escrow_contract_id: escrow.id,
            case_id: parsed.data.caseId,
            type: "release",
            amount: updated.amount,
            currency: updated.currency,
            provider_reference: escrow.provider_reference,
            provider_status: "provider_confirmed_release",
            status: "confirmed",
            initiated_by: ctx.profile.id,
            notes: parsed.data.note,
          });

        if (releaseTxnError) {
          return fail(releaseTxnError.message);
        }
      }

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.withdrawal_reviewed",
        entityType: "withdrawal_request",
        entityId: updated.id,
        metadata: { status: parsed.data.status },
        reason: parsed.data.note,
      });

      if (escrow) {
        await logAudit(ctx.supabase, {
          actorId: ctx.profile.id,
          caseId: parsed.data.caseId,
          action: "escrow.withdrawal_status_synced",
          entityType: "escrow_contract",
          entityId: escrow.id,
          metadata: {
            withdrawal_status: parsed.data.status,
            escrow_status: escrow.escrow_status,
            release_status: escrow.release_status,
          },
          reason: parsed.data.note,
        });
      }

      const withdrawalNotice = withdrawalNotification(parsed.data.status);
      await notifyCaseClient({
        caseId: parsed.data.caseId,
        actorId: ctx.profile.id,
        type: withdrawalNotice.type,
        title: withdrawalNotice.title,
        body: withdrawalNotice.body,
        link: "/dashboard/cases",
      });

      revalidateCase(parsed.data.caseId);
      return ok(updated);
    }

    revalidateCase(parsed.data.caseId);
    return ok({
      status: parsed.data.status,
      admin_note: parsed.data.note,
      reviewed_by: "demo-admin",
      reviewed_at: nowIso(),
    });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not review withdrawal."
    );
  }
}

export async function generateRecoveryReceipt(input: {
  caseId: string;
  kind: RecoveryReceiptKind;
  title: string;
  amount?: number;
  currency: string;
  recipientEmail: string;
  notes: string;
}): Promise<ActionResult<RecoveryReceipt>> {
  const parsed = generateReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid receipt request.");
  }

  try {
    const ctx = await adminOrDemo();
    const draft: Omit<RecoveryReceipt, "id"> = {
      case_id: parsed.data.caseId,
      receipt_number: receiptNumber(),
      kind: parsed.data.kind,
      title: parsed.data.title,
      amount: parsed.data.amount ?? null,
      currency: parsed.data.currency.toUpperCase(),
      recipient_email: parsed.data.recipientEmail,
      issued_by: ctx?.profile.id ?? "demo-admin",
      issued_at: nowIso(),
      notes: parsed.data.notes,
    };
    const receipt: RecoveryReceipt = {
      id: DEMO_MODE ? demoPreviewReceiptId(draft) : makeId("receipt"),
      ...draft,
    };

    if (ctx) {
      const { data: storedReceipt, error } = await ctx.supabase
        .from("recovery_receipts")
        .insert(draft)
        .select("*")
        .single<RecoveryReceipt>();

      if (error || !storedReceipt) {
        return fail(error?.message ?? "Could not generate receipt.");
      }

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.receipt_generated",
        entityType: "recovery_receipt",
        entityId: storedReceipt.id,
        metadata: {
          receipt_number: storedReceipt.receipt_number,
          kind: storedReceipt.kind,
          amount: storedReceipt.amount,
        },
        reason: parsed.data.notes,
      });

      revalidateCase(parsed.data.caseId);
      return ok(storedReceipt);
    }

    revalidateCase(parsed.data.caseId);
    return ok(receipt);
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not generate receipt."
    );
  }
}

export async function sendReceiptEmailPlaceholder(input: {
  caseId: string;
  receiptId: string;
  recipientEmail: string;
  subject: string;
}): Promise<ActionResult<EmailLog>> {
  const parsed = sendReceiptEmailSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid email request.");
  }

  try {
    const ctx = await adminOrDemo();
    const emailDraft = {
      case_id: parsed.data.caseId,
      recipient_email: parsed.data.recipientEmail,
      subject: parsed.data.subject,
      status: "sent_placeholder" as const,
      provider_reference: "EMAIL-PLACEHOLDER",
      related_receipt_id: parsed.data.receiptId,
      created_at: nowIso(),
      sent_at: nowIso(),
    };

    if (ctx) {
      const { data: email, error } = await ctx.supabase
        .from("email_logs")
        .insert(emailDraft)
        .select("*")
        .single<EmailLog>();

      if (error || !email) {
        return fail(error?.message ?? "Could not create email record.");
      }

      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.receipt_email_placeholder_sent",
        entityType: "email_log",
        entityId: email.id,
        metadata: {
          receipt_id: parsed.data.receiptId,
          recipient_email: parsed.data.recipientEmail,
        },
        reason: "Placeholder email workflow.",
      });

      revalidateCase(parsed.data.caseId);
      return ok(email);
    }

    const email: EmailLog = {
      id: makeId("email"),
      ...emailDraft,
    };
    revalidateCase(parsed.data.caseId);
    return ok(email);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not send email.");
  }
}

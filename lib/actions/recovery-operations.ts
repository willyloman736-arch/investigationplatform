"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { DEMO_MODE } from "@/lib/constants";
import type {
  EmailLog,
  KycReview,
  KycStatus,
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
  status: z.enum(["not_started", "in_review", "verified", "rejected"]),
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
  revalidatePath(`/dashboard/cases/${caseId}`);
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
      // TODO: update recovery_kyc_reviews once the recovery tables are deployed.
      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.kyc_status_updated",
        entityType: "kyc_review",
        metadata: { status: parsed.data.status },
        reason: parsed.data.note,
      });
    }

    revalidateCase(parsed.data.caseId);
    return ok({
      status: parsed.data.status,
      review_note: parsed.data.note,
      reviewer_id: ctx?.profile.id ?? null,
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
    const entry: RecoveredFundsEntry = {
      id: makeId("recovered"),
      case_id: parsed.data.caseId,
      amount: parsed.data.amount,
      currency: parsed.data.currency.toUpperCase(),
      source_label: parsed.data.sourceLabel,
      provider_reference: parsed.data.providerReference?.trim() || null,
      visible_to_client: true,
      entered_by: ctx?.profile.id ?? "demo-admin",
      notes: parsed.data.notes,
      created_at: nowIso(),
    };

    if (ctx) {
      // TODO: insert into recovered_funds_entries and update escrow balance view.
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
    }

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
    const condition: WithdrawalCondition = {
      id: makeId("condition"),
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
      // TODO: insert into withdrawal_conditions.
      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.withdrawal_condition_added",
        entityType: "withdrawal_condition",
        entityId: condition.id,
        metadata: { gate: condition.gate, label: condition.label },
        reason: condition.description,
      });
    }

    revalidateCase(parsed.data.caseId);
    return ok(condition);
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not add withdrawal condition."
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
      // TODO: update withdrawal_requests. paid_out should only be set after
      // provider/payment confirmation is received server-side.
      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.withdrawal_reviewed",
        entityType: "withdrawal_request",
        metadata: { status: parsed.data.status },
        reason: parsed.data.note,
      });
    }

    revalidateCase(parsed.data.caseId);
    return ok({
      status: parsed.data.status,
      admin_note: parsed.data.note,
      reviewed_by: ctx?.profile.id ?? "demo-admin",
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
      // TODO: insert into recovery_receipts.
      await logAudit(ctx.supabase, {
        actorId: ctx.profile.id,
        caseId: parsed.data.caseId,
        action: "recovery.receipt_generated",
        entityType: "recovery_receipt",
        entityId: receipt.id,
        metadata: {
          receipt_number: receipt.receipt_number,
          kind: receipt.kind,
          amount: receipt.amount,
        },
        reason: parsed.data.notes,
      });
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
    const email: EmailLog = {
      id: makeId("email"),
      case_id: parsed.data.caseId,
      recipient_email: parsed.data.recipientEmail,
      subject: parsed.data.subject,
      status: "sent_placeholder",
      provider_reference: "EMAIL-PLACEHOLDER",
      related_receipt_id: parsed.data.receiptId,
      created_at: nowIso(),
      sent_at: nowIso(),
    };

    if (ctx) {
      // TODO: call a real email provider and store the provider response.
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
    }

    revalidateCase(parsed.data.caseId);
    return ok(email);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not send email.");
  }
}

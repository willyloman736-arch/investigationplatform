"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Secure case messaging server actions: sendMessage, markRead.
//
// SERVER-ONLY. Access is enforced (a non-admin must be a party on the case).
// Honest-copy note: messages are stored for dispute review — we do NOT claim
// end-to-end encryption. sendMessage is audited; markRead is not (low-signal).
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getAuthContext,
  userCanAccessCase,
  ok,
  fail,
  type ActionResult,
} from "@/lib/actions/_helpers";

// ── sendMessage ──────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  caseId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(5000, "Message is too long (5000 character max)."),
});

export interface SendMessageInput {
  caseId: string;
  body: string;
}

/**
 * Post a message to a case thread. The sender must have access to the case.
 * Audited (the body is NOT copied into the audit metadata — only that a message
 * was sent — to keep the audit trail lean and avoid duplicating content).
 */
export async function sendMessage(
  input: SendMessageInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid message.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op (return success so the composer clears).
    return ok({ id: "demo-message" });
  }
  const { supabase, profile } = ctx;

  const allowed = await userCanAccessCase(supabase, profile, parsed.data.caseId);
  if (!allowed) {
    return fail("You do not have access to this case.");
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      case_id: parsed.data.caseId,
      sender_id: profile.id,
      body: parsed.data.body,
      read: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return fail(error?.message ?? "Could not send the message.");
  }

  await logAudit(supabase, {
    actorId: profile.id,
    caseId: parsed.data.caseId,
    action: "message.sent",
    entityType: "chat_message",
    entityId: data.id,
    metadata: { length: parsed.data.body.length },
  });

  revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  return ok({ id: data.id });
}

// ── markRead ─────────────────────────────────────────────────────────────────

const markReadSchema = z.object({
  messageId: z.string().min(1),
});

export interface MarkReadInput {
  messageId: string;
}

/**
 * Mark a single message as read. The caller must have access to the message's
 * case (enforced via a lookup + access check). Not audited (low-signal event).
 */
export async function markRead(input: MarkReadInput): Promise<ActionResult> {
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid message reference.");
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode no-op.
    return ok();
  }
  const { supabase, profile } = ctx;

  // Look up the message's case so we can authorize the read.
  const { data: message } = await supabase
    .from("chat_messages")
    .select("id, case_id")
    .eq("id", parsed.data.messageId)
    .maybeSingle<{ id: string; case_id: string }>();

  if (!message) {
    return fail("Message not found.");
  }

  const allowed = await userCanAccessCase(supabase, profile, message.case_id);
  if (!allowed) {
    return fail("You do not have access to this message.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("chat_messages")
    .update({ read: true })
    .eq("id", parsed.data.messageId);

  if (error) {
    return fail(error.message);
  }

  revalidatePath(`/dashboard/cases/${message.case_id}`);
  revalidatePath(`/admin/cases/${message.case_id}`);
  return ok();
}

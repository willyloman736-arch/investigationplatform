// NEVER import in a client component — uses the service-role Supabase client.
// ─────────────────────────────────────────────────────────────────────────────
// Core notification dispatcher. Creates an in-app notification row (Realtime-
// enabled) and fans it out to email (Resend) + Web Push. Every step is guarded;
// these functions NEVER throw, so they can be awaited from any server action
// right after the primary mutation (mirrors lib/audit.ts).
//
// Notifications are inserted with the SERVICE-ROLE client (bypasses RLS); the
// recipient reads them back over Realtime under their own RLS policy.
// ─────────────────────────────────────────────────────────────────────────────
import { createAdminClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/email/resend";
import { sendPushToSubscriptions } from "@/lib/push/web-push";
import type { NotificationType } from "@/lib/types";

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  caseId?: string | null;
  actorId?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
  /** Override channels. In-app is always written; email/push default to on. */
  channels?: { email?: boolean; push?: boolean };
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  try {
    const admin = createAdminClient();

    // 1) In-app row (delivered to the recipient via Realtime).
    await admin.from("notifications").insert({
      recipient_id: input.recipientId,
      actor_id: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      case_id: input.caseId ?? null,
      link: input.link ?? null,
      metadata: input.metadata ?? {},
    });

    const wantEmail = input.channels?.email !== false;
    const wantPush = input.channels?.push !== false;
    if (!wantEmail && !wantPush) return;

    // 2) Email (respecting the user's email_notifications preference).
    if (wantEmail) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, email_notifications")
        .eq("id", input.recipientId)
        .maybeSingle<{ email: string | null; email_notifications: boolean }>();

      if (profile?.email && profile.email_notifications !== false) {
        await sendNotificationEmail({
          to: profile.email,
          title: input.title,
          body: input.body,
          link: input.link ?? null,
        });
      }
    }

    // 3) Web Push to every registered device; prune dead endpoints.
    if (wantPush) {
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("profile_id", input.recipientId);

      if (subs && subs.length > 0) {
        const { goneEndpoints } = await sendPushToSubscriptions(subs, {
          title: input.title,
          body: input.body,
          url: input.link ?? "/dashboard",
        });
        if (goneEndpoints.length > 0) {
          await admin
            .from("push_subscriptions")
            .delete()
            .in("endpoint", goneEndpoints);
        }
      }
    }
  } catch {
    // Best-effort only — notifications must never break the primary action.
  }
}

/**
 * Notify the CLIENT who owns a case (cases.created_by). Resolves the recipient
 * with the service-role client, then delegates to createNotification.
 */
export async function notifyCaseClient(input: {
  caseId: string;
  type: NotificationType;
  title: string;
  body: string;
  actorId?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: caseRow } = await admin
      .from("cases")
      .select("created_by, case_number")
      .eq("id", input.caseId)
      .maybeSingle<{ created_by: string | null; case_number: string }>();

    if (!caseRow?.created_by) return;

    await createNotification({
      recipientId: caseRow.created_by,
      type: input.type,
      title: input.title,
      body: input.body,
      caseId: input.caseId,
      actorId: input.actorId ?? null,
      link: input.link ?? "/dashboard/cases",
      metadata: { case_number: caseRow.case_number, ...(input.metadata ?? {}) },
    });
  } catch {
    // best-effort
  }
}

/** Notify a specific user directly (account-level events, e.g. suspension). */
export async function notifyUser(input: {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  actorId?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createNotification({
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body,
    actorId: input.actorId ?? null,
    link: input.link ?? "/dashboard",
    metadata: input.metadata ?? {},
  });
}

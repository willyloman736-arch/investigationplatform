"use server";

// User-facing notification actions: mark read, and manage Web Push
// subscriptions. All run with the user-scoped client; RLS guarantees a user can
// only touch their own rows.
import {
  getAuthContext,
  ok,
  fail,
  type ActionResult,
} from "@/lib/actions/_helpers";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return fail("Not authenticated.");

  const { error } = await ctx.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", ctx.profile.id)
    .is("read_at", null);

  if (error) return fail("Could not update notification.");
  return ok();
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return fail("Not authenticated.");

  const { error } = await ctx.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.profile.id)
    .is("read_at", null);

  if (error) return fail("Could not update notifications.");
  return ok();
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

export async function savePushSubscription(
  sub: PushSubscriptionInput
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return fail("Not authenticated.");
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) {
    return fail("Invalid push subscription.");
  }

  const { error } = await ctx.supabase.from("push_subscriptions").upsert(
    {
      profile_id: ctx.profile.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) return fail("Could not save push subscription.");
  return ok();
}

export async function deletePushSubscription(
  endpoint: string
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return fail("Not authenticated.");

  const { error } = await ctx.supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", ctx.profile.id);

  if (error) return fail("Could not remove push subscription.");
  return ok();
}

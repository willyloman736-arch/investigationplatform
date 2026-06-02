import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append a row to audit_logs. Best-effort: this function swallows all errors and
 * NEVER throws, so audit failures can never break a user-facing mutation. Call
 * it from server actions / route handlers after every important action.
 *
 * Pass a Supabase client created on the server (user-scoped or admin). The
 * audit_logs table is append-only by design.
 */
export interface LogAuditInput {
  actorId?: string | null;
  caseId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  reason?: string | null;
}

export async function logAudit(
  client: SupabaseClient,
  {
    actorId = null,
    caseId = null,
    action,
    entityType,
    entityId = null,
    metadata = {},
    reason = null,
  }: LogAuditInput
): Promise<void> {
  try {
    await client.from("audit_logs").insert({
      actor_id: actorId,
      case_id: caseId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      reason,
    });
  } catch {
    // Best-effort only. Intentionally swallow — auditing must never throw.
  }
}

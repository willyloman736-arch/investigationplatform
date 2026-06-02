// NEVER import in a client component.
// ─────────────────────────────────────────────────────────────────────────────
// Shared server-only helpers for the AEGIS server actions.
//
// These centralize authentication, role/ownership checks, and standard result
// shapes so every mutation in lib/actions/* behaves consistently and securely.
// Mutations always go through server actions / route handlers — never the client.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, PartyRole } from "@/lib/types";
import { DEMO_MODE } from "@/lib/constants";

/** Standard result returned by every server action. */
export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export function ok<T>(data?: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T = undefined>(error: string): ActionResult<T> {
  return { success: false, error };
}

/**
 * Resolve the authenticated user's profile (id, role, email, ...).
 *
 * In DEMO mode there is no Supabase session, so this returns null and callers
 * fall back to a graceful no-op (the UI stays demonstrable). In production this
 * loads auth.getUser() + the profiles row; throwing/returning null when there
 * is no valid session.
 */
export interface AuthContext {
  supabase: SupabaseClient;
  profile: Profile;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  // In DEMO mode we never touch Supabase; callers no-op gracefully.
  if (DEMO_MODE) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) return null;
  return { supabase, profile };
}

/** True when the profile has the admin role. */
export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin";
}

/**
 * Assert the caller is an admin. Throws (string thrown is surfaced to the UI by
 * Next's action error boundary) when not. Use inside admin-only actions.
 */
export function requireAdmin(profile: Profile): void {
  if (!isAdmin(profile)) {
    throw new Error("Forbidden: this action requires an administrator.");
  }
}

/**
 * Determine whether a user may access / mutate a case. Admins always may.
 * Non-admins must be a party on the case (case_parties.profile_id) OR the
 * case creator. RLS enforces this at the database layer too; this is a
 * defense-in-depth check in the application layer.
 */
export async function userCanAccessCase(
  supabase: SupabaseClient,
  profile: Profile,
  caseId: string
): Promise<boolean> {
  if (isAdmin(profile)) return true;

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id, created_by")
    .eq("id", caseId)
    .maybeSingle<{ id: string; created_by: string }>();

  if (caseRow?.created_by === profile.id) return true;

  const { data: party } = await supabase
    .from("case_parties")
    .select("id")
    .eq("case_id", caseId)
    .eq("profile_id", profile.id)
    .maybeSingle<{ id: string }>();

  return Boolean(party);
}

/**
 * Resolve the PartyRole a given profile holds on a case (party_a / party_b /
 * observer), or null if they are not a party. Used so a user can only submit an
 * approval for their own side.
 */
export async function partyRoleForUser(
  supabase: SupabaseClient,
  profile: Profile,
  caseId: string
): Promise<PartyRole | null> {
  const { data } = await supabase
    .from("case_parties")
    .select("party_role")
    .eq("case_id", caseId)
    .eq("profile_id", profile.id)
    .maybeSingle<{ party_role: PartyRole }>();
  return data?.party_role ?? null;
}

/** Read + trim a single string field from FormData. */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

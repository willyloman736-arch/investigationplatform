"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Account recovery via the user's recovery phrase. SERVER-ONLY.
//
// Verifies email + recovery phrase against the stored scrypt hash (read with the
// service-role client, since account_recovery is RLS-locked to the service role)
// and, on a match, resets the account password. The phrase is never stored or
// logged — only compared against the hash in memory.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { DEMO_MODE } from "@/lib/constants";
import {
  normalizeRecoveryPhrase,
  validateRecoveryPhrase,
} from "@/lib/recovery/phrase";
import { verifyPhrase } from "@/lib/recovery/hash";
import { ok, fail, type ActionResult } from "@/lib/actions/_helpers";

const recoverSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  phrase: z.string().trim().min(1, "Enter your recovery phrase."),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
});

export interface RecoverAccountInput {
  email: string;
  phrase: string;
  newPassword: string;
}

// Deliberately generic so the endpoint cannot be used to enumerate which emails
// exist or which have a recovery phrase set.
const GENERIC_FAIL = "The email and recovery phrase do not match our records.";

/**
 * Reset a user's password after they prove ownership with their recovery phrase.
 */
export async function recoverAccount(
  input: RecoverAccountInput
): Promise<ActionResult> {
  const parsed = recoverSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  if (!validateRecoveryPhrase(parsed.data.phrase)) {
    return fail("That doesn't look like a valid 12-word recovery phrase.");
  }

  // DEMO: there is no Supabase project; don't pretend to reset anything.
  // TODO(demo): real recovery requires Supabase + the service role key.
  if (DEMO_MODE) {
    return fail("Account recovery is unavailable in demo mode.");
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Recovery is temporarily unavailable. Please contact support.");
  }

  const email = parsed.data.email.toLowerCase();

  // Service role bypasses RLS for these privileged reads/writes.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();
  if (!profile) return fail(GENERIC_FAIL);

  const { data: rec } = await admin
    .from("account_recovery")
    .select("phrase_hash")
    .eq("profile_id", profile.id)
    .maybeSingle<{ phrase_hash: string }>();
  if (!rec?.phrase_hash) return fail(GENERIC_FAIL);

  const valid = await verifyPhrase(
    normalizeRecoveryPhrase(parsed.data.phrase),
    rec.phrase_hash
  );
  if (!valid) return fail(GENERIC_FAIL);

  const { error: updateError } = await admin.auth.admin.updateUserById(
    profile.id,
    { password: parsed.data.newPassword }
  );
  if (updateError) {
    return fail("Could not reset the password. Please try again.");
  }

  // Audit the recovery event — never include the phrase.
  await logAudit(admin, {
    actorId: profile.id,
    action: "auth.account_recovered",
    entityType: "auth_user",
    entityId: profile.id,
    metadata: { method: "recovery_phrase" },
  });

  return ok();
}

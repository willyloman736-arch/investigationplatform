"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/actions/_helpers";

const escrowSignupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full legal name."),
  phone: z.string().trim().min(7, "Enter a valid phone number."),
  accountType: z.enum(["Individual", "Business"]),
  country: z.string().trim().min(2, "Select your country."),
  caseCode: z.string().trim().optional(),
});

function referenceFor(profileId: string) {
  return `ESC-${profileId.slice(0, 8).toUpperCase()}-${Date.now()
    .toString()
    .slice(-6)}`;
}

export async function createSecureEscrowAccount(
  formData: FormData
): Promise<void> {
  const parsed = escrowSignupSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    accountType: formData.get("accountType"),
    country: formData.get("country"),
    caseCode: formData.get("caseCode"),
  });

  if (!parsed.success) {
    redirect(
      `/dashboard/escrow/create?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Invalid escrow signup."
      )}`
    );
  }

  const ctx = await getAuthContext();
  if (!ctx) return;

  if (!ctx.profile.is_verified) {
    redirect("/dashboard/kyc");
  }

  const admin = createAdminClient();
  const reference =
    ctx.profile.escrow_account_reference ?? referenceFor(ctx.profile.id);

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      escrow_account_status: "active",
      escrow_account_reference: reference,
      escrow_account_opened_at:
        ctx.profile.escrow_account_opened_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.profile.id);

  if (error) {
    redirect(
      `/dashboard/escrow/create?error=${encodeURIComponent(error.message)}`
    );
  }

  await logAudit(admin, {
    actorId: ctx.profile.id,
    action: "escrow_account.created",
    entityType: "profile",
    entityId: ctx.profile.id,
    metadata: {
      account_type: parsed.data.accountType,
      country: parsed.data.country,
      case_code: parsed.data.caseCode ?? null,
      reference,
    },
  });

  revalidatePath("/dashboard/escrow");
  revalidatePath("/dashboard/escrow/create");
  redirect("/dashboard/escrow");
}

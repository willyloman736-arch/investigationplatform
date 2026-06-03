"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DEMO_MODE } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { fail, getAuthContext, ok, type ActionResult } from "@/lib/actions/_helpers";
import type { Profile } from "@/lib/types";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a valid image URL.");

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your display name.").max(90),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  avatarUrl: optionalUrl,
});

export async function updateProfile(input: {
  fullName: string;
  company?: string;
  phone?: string;
  avatarUrl?: string;
}): Promise<ActionResult<Profile>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid profile details.");
  }

  if (DEMO_MODE) {
    return ok({
      id: "demo-profile",
      email: "client@dai.demo",
      full_name: parsed.data.fullName,
      role: "client",
      company: parsed.data.company?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      avatar_url: parsed.data.avatarUrl || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const ctx = await getAuthContext();
  if (!ctx) return fail("You must be signed in to update your profile.");

  const patch = {
    full_name: parsed.data.fullName,
    company: parsed.data.company?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    avatar_url: parsed.data.avatarUrl || null,
  };

  const { data, error } = await ctx.supabase
    .from("profiles")
    .update(patch)
    .eq("id", ctx.profile.id)
    .select("*")
    .single<Profile>();

  if (error || !data) {
    return fail(error?.message ?? "Could not update your profile.");
  }

  await ctx.supabase.auth.updateUser({
    data: {
      full_name: patch.full_name,
      avatar_url: patch.avatar_url,
      company: patch.company,
      phone: patch.phone,
    },
  });

  await logAudit(ctx.supabase, {
    actorId: ctx.profile.id,
    action: "profile.updated",
    entityType: "profile",
    entityId: ctx.profile.id,
    metadata: {
      changed_fields: ["full_name", "company", "phone", "avatar_url"],
    },
    reason: "User updated profile settings.",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cases");
  revalidatePath("/dashboard/profile");

  return ok(data);
}

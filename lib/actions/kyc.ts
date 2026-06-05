"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import {
  ACCEPTED_KYC_FILE_TYPES,
  DEMO_MODE,
  MAX_KYC_FILE_SIZE,
} from "@/lib/constants";
import {
  fail,
  field,
  getAuthContext,
  ok,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions/_helpers";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  KycAuditAction,
  KycDocumentStatus,
  KycIdType,
  KycProofType,
  KycStatus,
  KycSubmission,
} from "@/lib/types";

const KYC_BUCKET = "kyc-documents";
const ID_TYPES: KycIdType[] = ["passport", "drivers_license", "national_id"];
const PROOF_TYPES: KycProofType[] = [
  "utility_bill",
  "bank_statement",
  "lease_agreement",
  "tax_document",
];

const personalSchema = z.object({
  fullLegalName: z.string().trim().min(2, "Enter your full legal name.").max(140),
  dateOfBirth: z.string().trim().min(1, "Enter your date of birth."),
  nationality: z.string().trim().min(2, "Enter your nationality.").max(80),
  residentialAddress: z
    .string()
    .trim()
    .min(8, "Enter your residential address.")
    .max(500),
  phone: z.string().trim().min(6, "Enter your phone number.").max(40),
  email: z.string().trim().email("Enter a valid email address."),
  idType: z.enum(["passport", "drivers_license", "national_id"]),
  idNumber: z.string().trim().min(2, "Enter your ID number.").max(120),
  issuingCountry: z.string().trim().min(2, "Enter the issuing country.").max(80),
  idExpiryDate: z.string().trim().min(1, "Enter the ID expiry date."),
  proofType: z.enum([
    "utility_bill",
    "bank_statement",
    "lease_agreement",
    "tax_document",
  ]),
});

const reviewSchema = z.object({
  submissionId: z.string().uuid("Invalid submission reference."),
  status: z.enum(["verified", "declined", "resubmission_required"]),
  note: z.string().trim().max(2000).optional().default(""),
});

function nowIso(): string {
  return new Date().toISOString();
}

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 140);
  return `${Date.now()}_${cleaned || "kyc-document"}`;
}

function fileExtension(name: string): string {
  const lower = name.toLowerCase();
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function validateKycFile(file: File, label: string): string | null {
  if (file.size <= 0) return `${label} is required.`;
  if (file.size > MAX_KYC_FILE_SIZE) {
    return `${label} exceeds the ${formatMb(MAX_KYC_FILE_SIZE)} limit.`;
  }

  const ext = fileExtension(file.name);
  const mimeMatch = file.type
    ? Object.keys(ACCEPTED_KYC_FILE_TYPES).includes(file.type)
    : false;
  const extMatch = Object.values(ACCEPTED_KYC_FILE_TYPES).some((exts) =>
    exts.includes(ext)
  );

  if (!mimeMatch && !extMatch) {
    return `${label} must be a JPG, PNG, or PDF file.`;
  }

  return null;
}

function formFile(formData: FormData, name: string): File | null {
  const file = formData.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

async function uploadKycFile({
  file,
  label,
  userId,
  submissionId,
}: {
  file: File;
  label: string;
  userId: string;
  submissionId: string;
}): Promise<{ path: string; error?: string }> {
  const validation = validateKycFile(file, label);
  if (validation) return { path: "", error: validation };

  const admin = createAdminClient();
  const path = `${userId}/${submissionId}/${label}-${safeFileName(file.name)}`;
  const { error } = await admin.storage.from(KYC_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  return error ? { path, error: error.message } : { path };
}

function revalidateKycSurfaces(userId?: string, submissionId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cases");
  revalidatePath("/dashboard/kyc");
  revalidatePath("/dashboard/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/kyc");
  if (submissionId) revalidatePath(`/admin/kyc/${submissionId}`);
  if (userId) revalidatePath(`/admin/kyc?user=${userId}`);
}

function legacyKycDocumentPatch(status: KycStatus): {
  government_id_status: KycDocumentStatus;
  selfie_status: KycDocumentStatus;
  proof_of_address_status: KycDocumentStatus;
  phone_verified: boolean;
  email_verified: boolean;
} {
  if (status === "verified") {
    return {
      government_id_status: "verified",
      selfie_status: "verified",
      proof_of_address_status: "verified",
      phone_verified: true,
      email_verified: true,
    };
  }
  if (
    status === "declined" ||
    status === "rejected" ||
    status === "resubmission_required"
  ) {
    return {
      government_id_status: "rejected",
      selfie_status: "rejected",
      proof_of_address_status: "rejected",
      phone_verified: false,
      email_verified: false,
    };
  }
  if (status === "pending_review" || status === "in_review") {
    return {
      government_id_status: "submitted",
      selfie_status: "submitted",
      proof_of_address_status: "submitted",
      phone_verified: false,
      email_verified: true,
    };
  }
  return {
    government_id_status: "not_submitted",
    selfie_status: "not_submitted",
    proof_of_address_status: "not_submitted",
    phone_verified: false,
    email_verified: false,
  };
}

async function syncCaseKycReviews({
  userId,
  status,
  note,
  reviewerId,
}: {
  userId: string;
  status: KycStatus;
  note: string;
  reviewerId?: string | null;
}) {
  const admin = createAdminClient();
  const patch = legacyKycDocumentPatch(status);
  await admin
    .from("recovery_kyc_reviews")
    .update({
      status,
      ...patch,
      reviewer_id: reviewerId ?? null,
      review_note: note,
      updated_at: nowIso(),
    })
    .eq("profile_id", userId);
}

async function writeKycAudit({
  userId,
  submissionId,
  action,
  actorId,
  actorRole,
  notes,
}: {
  userId: string;
  submissionId?: string | null;
  action: KycAuditAction;
  actorId?: string | null;
  actorRole: "client" | "counterparty" | "admin";
  notes?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("kyc_audit_logs").insert({
    user_id: userId,
    submission_id: submissionId ?? null,
    action,
    actor_id: actorId ?? null,
    actor_role: actorRole,
    notes: notes ?? null,
  });
}

export async function submitKycSubmission(
  formData: FormData
): Promise<ActionResult<{ submissionId: string }>> {
  if (DEMO_MODE) {
    return ok({ submissionId: "demo-kyc-submission" });
  }

  const ctx = await getAuthContext();
  if (!ctx) return fail("You must be signed in to submit KYC.");
  const { profile, supabase } = ctx;

  const parsed = personalSchema.safeParse({
    fullLegalName: field(formData, "fullLegalName"),
    dateOfBirth: field(formData, "dateOfBirth"),
    nationality: field(formData, "nationality"),
    residentialAddress: field(formData, "residentialAddress"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    idType: field(formData, "idType"),
    idNumber: field(formData, "idNumber"),
    issuingCountry: field(formData, "issuingCountry"),
    idExpiryDate: field(formData, "idExpiryDate"),
    proofType: field(formData, "proofType"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid KYC details.");
  }

  if (!ID_TYPES.includes(parsed.data.idType)) return fail("Select an ID type.");
  if (!PROOF_TYPES.includes(parsed.data.proofType)) {
    return fail("Select a proof-of-address document type.");
  }

  const idFront = formFile(formData, "idFront");
  const idBack = formFile(formData, "idBack");
  const selfie = formFile(formData, "selfie");
  const proofOfAddress = formFile(formData, "proofOfAddress");

  if (!idFront) return fail("Upload the front of your government ID.");
  if (parsed.data.idType !== "passport" && !idBack) {
    return fail("Upload the back of your government ID.");
  }
  if (!selfie) return fail("Upload a clear selfie that matches your government ID.");
  if (!proofOfAddress) return fail("Upload your proof of address.");

  const submissionId = globalThis.crypto.randomUUID();
  const uploadedPaths: string[] = [];

  async function uploadRequired(file: File, label: string): Promise<string | null> {
    const result = await uploadKycFile({
      file,
      label,
      userId: profile.id,
      submissionId,
    });
    if (result.error) return null;
    uploadedPaths.push(result.path);
    return result.path;
  }

  const idFrontPath = await uploadRequired(idFront, "id-front");
  const idBackPath = idBack ? await uploadRequired(idBack, "id-back") : null;
  const selfiePath = await uploadRequired(selfie, "selfie");
  const proofPath = await uploadRequired(proofOfAddress, "proof-of-address");

  if (!idFrontPath || (idBack && !idBackPath) || !selfiePath || !proofPath) {
    const admin = createAdminClient();
    if (uploadedPaths.length > 0) {
      await admin.storage.from(KYC_BUCKET).remove(uploadedPaths);
    }
    return fail("One or more KYC documents could not be uploaded. Please try again.");
  }

  const admin = createAdminClient();
  const now = nowIso();
  const { error } = await admin.from("kyc_submissions").insert({
    id: submissionId,
    user_id: profile.id,
    full_legal_name: parsed.data.fullLegalName,
    date_of_birth: parsed.data.dateOfBirth,
    nationality: parsed.data.nationality,
    residential_address: parsed.data.residentialAddress,
    phone: parsed.data.phone,
    email: parsed.data.email,
    id_type: parsed.data.idType,
    id_number: parsed.data.idNumber,
    issuing_country: parsed.data.issuingCountry,
    id_expiry_date: parsed.data.idExpiryDate,
    id_front_url: idFrontPath,
    id_back_url: idBackPath,
    selfie_url: selfiePath,
    proof_type: parsed.data.proofType,
    proof_of_address_url: proofPath,
    status: "pending_review",
    admin_notes: null,
    reviewed_by: null,
    reviewed_at: null,
  });

  if (error) {
    await admin.storage.from(KYC_BUCKET).remove(uploadedPaths);
    return fail(error.message);
  }

  await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullLegalName,
      phone: parsed.data.phone,
      kyc_status: "pending_review",
      is_verified: false,
      updated_at: now,
    })
    .eq("id", profile.id);

  await supabase.auth.updateUser({
    data: {
      full_name: parsed.data.fullLegalName,
      phone: parsed.data.phone,
      kyc_status: "pending_review",
      is_verified: false,
    },
  });

  await syncCaseKycReviews({
    userId: profile.id,
    status: "pending_review",
    note: "Identity verification submitted and awaiting review.",
    reviewerId: null,
  });

  await writeKycAudit({
    userId: profile.id,
    submissionId,
    action: "submitted",
    actorId: profile.id,
    actorRole: profile.role,
    notes: "Client submitted a complete KYC package.",
  });

  await logAudit(admin, {
    actorId: profile.id,
    action: "kyc.submitted",
    entityType: "kyc_submission",
    entityId: submissionId,
    metadata: {
      id_type: parsed.data.idType,
      proof_type: parsed.data.proofType,
      document_paths: uploadedPaths.length,
    },
    reason: "Client submitted identity verification.",
  });

  revalidateKycSurfaces(profile.id, submissionId);
  return ok({ submissionId });
}

export async function reviewKycSubmission(input: {
  submissionId: string;
  status: Extract<KycStatus, "verified" | "declined" | "resubmission_required">;
  note?: string;
}): Promise<ActionResult<KycSubmission>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid review action.");
  }

  const note =
    parsed.data.note.trim() ||
    (parsed.data.status === "verified"
      ? "Identity verified after document review."
      : "");

  if (
    (parsed.data.status === "declined" ||
      parsed.data.status === "resubmission_required") &&
    !note
  ) {
    return fail("A review note is required for decline or resubmission.");
  }

  if (DEMO_MODE) {
    return ok({
      id: parsed.data.submissionId,
      user_id: "demo-profile",
      full_legal_name: "Jordan Avery",
      date_of_birth: "1990-01-01",
      nationality: "United States",
      residential_address: "Demo address",
      phone: "+1 555 000 0000",
      email: "client@dai.demo",
      id_type: "passport",
      id_number: "DEMO",
      issuing_country: "United States",
      id_expiry_date: "2030-01-01",
      id_front_url: "",
      id_back_url: null,
      selfie_url: "",
      proof_type: "utility_bill",
      proof_of_address_url: "",
      status: parsed.data.status,
      admin_notes: note,
      reviewed_by: "demo-admin",
      reviewed_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  const ctx = await getAuthContext();
  if (!ctx) return fail("You must be signed in as an administrator.");
  requireAdmin(ctx.profile);

  const admin = createAdminClient();
  const { data: current, error: loadError } = await admin
    .from("kyc_submissions")
    .select("*")
    .eq("id", parsed.data.submissionId)
    .maybeSingle<KycSubmission>();

  if (loadError || !current) {
    return fail(loadError?.message ?? "KYC submission not found.");
  }

  const reviewedAt = nowIso();
  const { data: updated, error } = await admin
    .from("kyc_submissions")
    .update({
      status: parsed.data.status,
      admin_notes: note,
      reviewed_by: ctx.profile.id,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", parsed.data.submissionId)
    .select("*")
    .single<KycSubmission>();

  if (error || !updated) {
    return fail(error?.message ?? "Could not update KYC submission.");
  }

  await admin
    .from("profiles")
    .update({
      kyc_status: parsed.data.status,
      is_verified: parsed.data.status === "verified",
      updated_at: reviewedAt,
    })
    .eq("id", current.user_id);

  await syncCaseKycReviews({
    userId: current.user_id,
    status: parsed.data.status,
    note,
    reviewerId: ctx.profile.id,
  });

  const action: KycAuditAction =
    parsed.data.status === "verified"
      ? "approved"
      : parsed.data.status === "declined"
      ? "declined"
      : "resubmission_requested";

  await writeKycAudit({
    userId: current.user_id,
    submissionId: current.id,
    action,
    actorId: ctx.profile.id,
    actorRole: ctx.profile.role,
    notes: note,
  });

  await logAudit(admin, {
    actorId: ctx.profile.id,
    action: "kyc.reviewed",
    entityType: "kyc_submission",
    entityId: current.id,
    metadata: { status: parsed.data.status, user_id: current.user_id },
    reason: note,
  });

  revalidateKycSurfaces(current.user_id, current.id);
  return ok(updated);
}

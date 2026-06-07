"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Evidence upload server action: uploadFile.
//
// SERVER-ONLY. Validates file type vs ACCEPTED_FILE_TYPES and size <=
// MAX_FILE_SIZE BEFORE touching storage, uploads to the "evidence" bucket at
// `<caseId>/<filename>`, inserts an uploaded_files row, and audits. Access is
// enforced (a non-admin must be a party on the case). In DEMO mode the real
// upload is skipped and a success result is returned so the UI stays usable.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_FILE_TYPES_COMBINED,
  MAX_FILE_SIZE,
} from "@/lib/constants";
import type { FileCategory } from "@/lib/types";
import {
  getAuthContext,
  userCanAccessCase,
  field,
  ok,
  fail,
  type ActionResult,
} from "@/lib/actions/_helpers";

const FILE_CATEGORIES: FileCategory[] = [
  "csv",
  "pdf_receipt",
  "image_receipt",
  "chat_log",
  "text",
  "tx_hash",
  "other",
];

const STORAGE_BUCKET = "evidence";

/**
 * Validate an uploaded file's MIME type and extension against the accept map for
 * its declared category (falling back to the combined accept map). Returns an
 * error string when invalid, or null when acceptable.
 */
function validateFileType(file: File, category: FileCategory): string | null {
  const accept = ACCEPTED_FILE_TYPES[category] ?? ACCEPTED_FILE_TYPES_COMBINED;
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  // Accept when EITHER the MIME type matches a configured key, OR the file
  // extension matches one of the allowed extensions (browsers occasionally
  // report empty/odd MIME types, so the extension is a reliable backstop).
  const mimeMatch = file.type ? Object.keys(accept).includes(file.type) : false;
  const extMatch = Object.values(accept).some((exts) => exts.includes(ext));

  if (mimeMatch || extMatch) return null;

  return `Unsupported file type for "${category}". Allowed: ${Object.values(
    accept
  )
    .flat()
    .join(", ")}.`;
}

/** Sanitize a filename for use as a storage path segment. */
function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_");
  // Prefix with a timestamp to avoid collisions within a case folder.
  return `${Date.now()}_${base}`.slice(0, 200);
}

/**
 * Upload a piece of evidence to a case.
 *
 * Expected FormData fields:
 *  - file        (File, required)
 *  - caseId      (string, required)
 *  - file_type   (FileCategory, required)
 *  - notes       (string, optional)
 */
export async function uploadFile(formData: FormData): Promise<ActionResult> {
  const caseId = field(formData, "caseId");
  const rawCategory = field(formData, "file_type");
  const notes = field(formData, "notes");
  const file = formData.get("file");

  if (!caseId) return fail("Missing case reference.");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Please choose a file to upload.");
  }

  const category: FileCategory = FILE_CATEGORIES.includes(
    rawCategory as FileCategory
  )
    ? (rawCategory as FileCategory)
    : "other";

  // ── Size validation (before any upload) ────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    const mb = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    return fail(`File is too large. Maximum size is ${mb} MB.`);
  }

  // ── Type validation (before any upload) ────────────────────────────────────
  const typeError = validateFileType(file, category);
  if (typeError) return fail(typeError);

  const ctx = await getAuthContext();
  if (!ctx) {
    // TODO: DEMO mode — skip the real Supabase Storage upload and DB insert.
    // Return success so the uploader UI can show its confirmation toast.
    return ok();
  }
  const { supabase, profile } = ctx;

  // ── Access control ─────────────────────────────────────────────────────────
  const allowed = await userCanAccessCase(supabase, profile, caseId);
  if (!allowed) {
    return fail("You do not have access to this case.");
  }

  // ── Upload to Supabase Storage at `<caseId>/<filename>` ────────────────────
  const fileName = safeFileName(file.name);
  const storagePath = `${caseId}/${fileName}`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return fail(`Upload failed: ${uploadError.message}`);
  }

  // Evidence is private; expose a path, not a public URL. The UI can request a
  // signed URL on demand. We store file_url as null here.
  const { error: insertError } = await admin.from("uploaded_files").insert({
    case_id: caseId,
    uploaded_by: profile.id,
    file_name: file.name,
    file_type: category,
    storage_path: storagePath,
    file_url: null,
    size_bytes: file.size,
    notes: notes || null,
  });

  if (insertError) {
    // Best-effort cleanup of the orphaned object so storage and DB stay in sync.
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return fail(`Could not record the file: ${insertError.message}`);
  }

  await logAudit(supabase, {
    actorId: profile.id,
    caseId,
    action: "file.uploaded",
    entityType: "uploaded_file",
    metadata: {
      fileName: file.name,
      fileType: category,
      sizeBytes: file.size,
      storagePath,
    },
  });

  revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath(`/admin/cases/${caseId}`);
  return ok();
}

import { NextResponse } from "next/server";

import { DEMO_MODE } from "@/lib/constants";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Profile, UploadedFile } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { fileId: string };
}

async function hasFileAccess(
  admin: ReturnType<typeof createAdminClient>,
  profile: Pick<Profile, "id" | "role">,
  file: Pick<UploadedFile, "case_id">
): Promise<boolean> {
  if (profile.role === "admin") return true;

  const [{ data: caseRow }, { data: partyRow }] = await Promise.all([
    admin
      .from("cases")
      .select("created_by, assigned_admin")
      .eq("id", file.case_id)
      .maybeSingle<{ created_by: string; assigned_admin: string | null }>(),
    admin
      .from("case_parties")
      .select("id")
      .eq("case_id", file.case_id)
      .eq("profile_id", profile.id)
      .maybeSingle<{ id: string }>(),
  ]);

  return (
    caseRow?.created_by === profile.id ||
    caseRow?.assigned_admin === profile.id ||
    Boolean(partyRow)
  );
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (DEMO_MODE) {
    return NextResponse.json(
      { error: "Evidence downloads are unavailable in demo mode." },
      { status: 404 }
    );
  }

  const fileId = params.fileId?.trim();
  if (!fileId) {
    return NextResponse.json({ error: "Missing file id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<Pick<Profile, "id" | "role">>();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: file, error: fileError } = await admin
    .from("uploaded_files")
    .select("*")
    .eq("id", fileId)
    .maybeSingle<UploadedFile>();
  if (fileError || !file) {
    return NextResponse.json({ error: "Evidence file not found." }, { status: 404 });
  }

  const allowed = await hasFileAccess(admin, profile, file);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await admin.storage
    .from("evidence")
    .createSignedUrl(file.storage_path, 60 * 10, {
      download: file.file_name,
    });

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create evidence link." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}

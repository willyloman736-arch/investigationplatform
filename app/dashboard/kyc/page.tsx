import { redirect } from "next/navigation";

import { APP_NAME, DEMO_MODE } from "@/lib/constants";
import { getCurrentUserMock, getLatestKycSubmissionForUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { KycWizard } from "@/components/dashboard/KycWizard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `KYC Verification · ${APP_NAME}`,
};

async function resolveProfile(): Promise<Profile> {
  if (DEMO_MODE) {
    return getCurrentUserMock("client");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");
  return profile;
}

export default async function DashboardKycPage() {
  const profile = await resolveProfile();
  const latestSubmission = await getLatestKycSubmissionForUser(profile.id);

  return <KycWizard profile={profile} latestSubmission={latestSubmission} />;
}

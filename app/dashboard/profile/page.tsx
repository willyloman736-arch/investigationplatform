import { redirect } from "next/navigation";
import { Mail, Settings, ShieldCheck, UserRound } from "lucide-react";

import { DEMO_MODE } from "@/lib/constants";
import { getCurrentUserMock, getRecoveryOperationsCases } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { KycVerificationPanel } from "@/components/dashboard/KycVerificationPanel";
import { ProfileSettingsForm } from "@/components/dashboard/ProfileSettingsForm";

export const dynamic = "force-dynamic";

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

export default async function DashboardProfilePage() {
  const profile = await resolveProfile();
  const operations = await getRecoveryOperationsCases(profile.role, profile.id);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:rounded-3xl sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              Profile & settings
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Your account profile
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Keep your recovery case identity, escrow contact details, and
              account photo up to date.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[520px]">
            <ProfileMiniStat
              label="Identity"
              value={profile.full_name ? "Named" : "Needed"}
              icon={UserRound}
            />
            <ProfileMiniStat
              label="Email"
              value={profile.email ? "Linked" : "Missing"}
              icon={Mail}
            />
            <ProfileMiniStat
              label="Role"
              value={profile.role}
              icon={ShieldCheck}
            />
          </div>
        </div>
      </section>

      <KycVerificationPanel profile={profile} operations={operations} />

      <ProfileSettingsForm profile={profile} />
    </div>
  );
}

function ProfileMiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-2.5 backdrop-blur-xl sm:p-3">
      <div className="flex items-center justify-between gap-1.5">
        <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" aria-hidden="true" />
      </div>
      <p className="mt-2 truncate text-xs font-semibold capitalize text-foreground sm:text-sm">
        {value}
      </p>
    </div>
  );
}

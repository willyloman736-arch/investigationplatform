import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Mail, Settings, ShieldCheck, UserRound } from "lucide-react";

import {
  DEMO_MODE,
  KYC_STATUS_BADGE_VARIANTS,
  KYC_STATUS_LABELS,
} from "@/lib/constants";
import { getCurrentUserMock } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ProfileSettingsForm } from "@/components/dashboard/ProfileSettingsForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const kycStatus = profile.kyc_status ?? "not_started";

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
              value={profile.is_verified ? "Verified" : KYC_STATUS_LABELS[kycStatus]}
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

      <KycStatusCard profile={profile} />

      <ProfileSettingsForm profile={profile} />
    </div>
  );
}

function KycStatusCard({ profile }: { profile: Profile }) {
  const status = profile.kyc_status ?? "not_started";
  const verified = profile.is_verified || status === "verified";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
            {verified ? (
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">
                Identity verification
              </h2>
              <Badge variant={KYC_STATUS_BADGE_VARIANTS[status]}>
                {verified ? "Identity Verified" : KYC_STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Verification connects your profile, recovery files, and escrow
              transfer eligibility to one reviewed account record.
            </p>
          </div>
        </div>

        <Button asChild className="h-11 rounded-xl">
          <Link href="/dashboard/kyc">
            {verified ? "View verification" : "Complete KYC"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
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

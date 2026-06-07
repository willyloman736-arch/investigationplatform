import {
  CalendarClock,
  IdCard,
  type LucideIcon,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  APP_NAME,
  KYC_STATUS_BADGE_VARIANTS,
  KYC_STATUS_LABELS,
} from "@/lib/constants";
import { getProfilesForAdmin } from "@/lib/data";
import type { AccountStatus, Profile, UserRole } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Users · ${APP_NAME}`,
};

function roleLabel(role: UserRole): string {
  if (role === "admin") return "Administrator";
  if (role === "counterparty") return "Counterparty";
  return "Client";
}

function statusLabel(status?: AccountStatus): string {
  return status === "suspended" ? "Suspended" : "Active";
}

function filterProfiles(profiles: Profile[], search: string): Profile[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return profiles;
  return profiles.filter((profile) =>
    [
      profile.id,
      profile.email,
      profile.full_name,
      profile.company,
      profile.phone,
      profile.role,
      profile.kyc_status,
      profile.account_status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const search = searchParams?.q ?? "";
  const allProfiles = await getProfilesForAdmin();
  const profiles = filterProfiles(allProfiles, search);
  const activeCount = allProfiles.filter(
    (profile) => profile.account_status !== "suspended"
  ).length;
  const verifiedCount = allProfiles.filter((profile) => profile.is_verified).length;
  const pendingKycCount = allProfiles.filter((profile) =>
    ["in_review", "pending_review", "resubmission_required"].includes(
      profile.kyc_status
    )
  ).length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Identity directory
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Users
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Review client profiles, account status, KYC standing, and contact
              records from one protected operations view.
            </p>
          </div>

          <form className="relative w-full lg:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search users..."
              className="h-12 rounded-2xl border-white/10 bg-background/45 pl-10 text-base"
            />
          </form>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Total users"
            value={allProfiles.length}
            icon={UsersRound}
          />
          <MetricCard
            label="Verified profiles"
            value={verifiedCount}
            icon={ShieldCheck}
          />
          <MetricCard
            label="KYC queue"
            value={pendingKycCount}
            icon={IdCard}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Profile records
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">
              {profiles.length} shown
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {activeCount} active accounts
          </p>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.035] px-6 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">
              No users match this search
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a name, email, role, KYC status, or profile ID.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {profiles.map((profile) => (
              <UserCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-background/35 p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function UserCard({ profile }: { profile: Profile }) {
  const suspended = profile.account_status === "suspended";

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <UserRound className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-foreground">
              {profile.full_name ?? profile.email}
            </h3>
            <Badge variant={profile.role === "admin" ? "info" : "secondary"}>
              {roleLabel(profile.role)}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {profile.company ?? "Individual profile"}
          </p>
        </div>
        <Badge variant={suspended ? "destructive" : "success"}>
          {statusLabel(profile.account_status)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <InfoLine icon={Mail} label="Email" value={profile.email} />
        <InfoLine icon={Phone} label="Phone" value={profile.phone ?? "Not set"} />
        <InfoLine
          icon={IdCard}
          label="KYC"
          value={KYC_STATUS_LABELS[profile.kyc_status]}
          badge={
            <Badge variant={KYC_STATUS_BADGE_VARIANTS[profile.kyc_status]}>
              {profile.is_verified ? "Verified" : KYC_STATUS_LABELS[profile.kyc_status]}
            </Badge>
          }
        />
        <InfoLine
          icon={CalendarClock}
          label="Created"
          value={formatDateTime(profile.created_at)}
        />
      </div>

      <div
        className={cn(
          "mt-4 rounded-2xl border px-3 py-2 text-xs leading-relaxed",
          suspended
            ? "border-destructive/20 bg-destructive/10 text-destructive"
            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
        )}
      >
        Profile ID: <span className="font-mono">{profile.id}</span>
      </div>
    </article>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  badge?: import("react").ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 min-w-0 text-sm font-semibold text-foreground">
        {badge ?? <span className="break-words">{value}</span>}
      </div>
    </div>
  );
}

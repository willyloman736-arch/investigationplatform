import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  IdCard,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  APP_NAME,
  KYC_ID_TYPE_LABELS,
  KYC_PROOF_TYPE_LABELS,
  KYC_STATUS_BADGE_VARIANTS,
  KYC_STATUS_LABELS,
} from "@/lib/constants";
import { getKycSubmissionsForAdmin } from "@/lib/data";
import type { KycStatus, KycSubmissionWithProfile } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `KYC Queue · ${APP_NAME}`,
};

const FILTERS: Array<{
  label: string;
  value: KycStatus | "all";
  icon: typeof IdCard;
}> = [
  { label: "All", value: "all", icon: IdCard },
  { label: "Pending", value: "pending_review", icon: Clock },
  { label: "Verified", value: "verified", icon: CheckCircle2 },
  { label: "Resubmission", value: "resubmission_required", icon: RotateCcw },
  { label: "Declined", value: "declined", icon: XCircle },
];

function normalizeStatus(value: string | undefined): KycStatus | "all" {
  const allowed = FILTERS.map((filter) => filter.value);
  return allowed.includes(value as KycStatus | "all")
    ? (value as KycStatus | "all")
    : "pending_review";
}

export default async function AdminKycQueuePage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const status = normalizeStatus(searchParams?.status);
  const search = searchParams?.q ?? "";
  const submissions = await getKycSubmissionsForAdmin({ status, search });
  const allSubmissions = await getKycSubmissionsForAdmin({ status: "all" });

  const counts = allSubmissions.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    acc.all = (acc.all ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Identity operations
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              KYC verification queue
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Review identity packages, inspect private documents with signed
              links, and sync client verification status from one queue.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:w-[420px]">
            <Metric label="Pending" value={counts.pending_review ?? 0} />
            <Metric label="Verified" value={counts.verified ?? 0} />
            <Metric label="Resubmissions" value={counts.resubmission_required ?? 0} />
            <Metric label="Total" value={counts.all ?? 0} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((filter) => {
              const Icon = filter.icon;
              const active = status === filter.value;
              const href =
                filter.value === "pending_review"
                  ? "/admin/kyc"
                  : `/admin/kyc?status=${filter.value}`;
              return (
                <Button
                  key={filter.value}
                  asChild
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="shrink-0 rounded-xl"
                >
                  <Link href={href}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {filter.label}
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                      {counts[filter.value] ?? 0}
                    </span>
                  </Link>
                </Button>
              );
            })}
          </div>

          <form className="relative w-full lg:w-[360px]">
            <input type="hidden" name="status" value={status} />
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search name, email, phone, submission id..."
              className="h-11 rounded-xl border-white/10 bg-white/[0.055] pl-9"
            />
          </form>
        </div>

        {submissions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.035] p-8 text-center text-sm text-muted-foreground backdrop-blur-xl">
            No KYC submissions match this view.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {submissions.map((submission) => (
              <KycSubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function KycSubmissionCard({
  submission,
}: {
  submission: KycSubmissionWithProfile;
}) {
  const profile = submission.profile;
  const name = profile?.full_name ?? submission.full_legal_name;

  return (
    <article className="group rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors hover:border-primary/25 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{name}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {submission.email || profile?.email}
          </p>
        </div>
        <Badge variant={KYC_STATUS_BADGE_VARIANTS[submission.status]}>
          {KYC_STATUS_LABELS[submission.status]}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Info label="Phone" value={submission.phone} />
        <Info label="Submitted" value={formatDate(submission.created_at)} />
        <Info label="ID" value={KYC_ID_TYPE_LABELS[submission.id_type]} />
        <Info label="Address doc" value={KYC_PROOF_TYPE_LABELS[submission.proof_type]} />
      </div>

      {submission.admin_notes ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-background/35 p-3 text-sm text-muted-foreground">
          {submission.admin_notes}
        </div>
      ) : null}

      <Button asChild className="mt-4 h-11 w-full rounded-xl">
        <Link href={`/admin/kyc/${submission.id}`}>
          Open review
          <ArrowRight
            className={cn(
              "h-4 w-4 transition-transform",
              "group-hover:translate-x-0.5"
            )}
            aria-hidden="true"
          />
        </Link>
      </Button>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Search,
  ShieldCheck,
  type LucideIcon,
  XCircle,
} from "lucide-react";

import {
  APP_NAME,
  KYC_STATUS_BADGE_VARIANTS,
  KYC_STATUS_LABELS,
  PAYOUT_METHOD_LABELS,
  WITHDRAWAL_STATUS_BADGE_VARIANTS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import { getWithdrawalRequestsForAdmin } from "@/lib/data";
import type { WithdrawalRequestWithRelations, WithdrawalStatus } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WithdrawalReviewActions } from "@/components/admin/WithdrawalReviewActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Withdrawal Queue · ${APP_NAME}`,
};

const FILTERS: Array<{
  label: string;
  value: WithdrawalStatus | "all";
  icon: LucideIcon;
}> = [
  { label: "All", value: "all", icon: CreditCard },
  { label: "Pending", value: "pending_admin_review", icon: Clock },
  { label: "Approved", value: "approved_for_processing", icon: CheckCircle2 },
  { label: "Processing", value: "processing", icon: ShieldCheck },
  { label: "Paid", value: "paid", icon: CheckCircle2 },
  { label: "Rejected", value: "rejected", icon: XCircle },
];

const TERMINAL_STATUSES = new Set<WithdrawalStatus>([
  "approved_for_processing",
  "processing",
  "paid",
  "paid_out",
  "failed",
  "rejected",
  "denied",
  "cancelled",
]);

function normalizeStatus(value: string | undefined): WithdrawalStatus | "all" {
  const allowed = FILTERS.map((filter) => filter.value);
  return allowed.includes(value as WithdrawalStatus | "all")
    ? (value as WithdrawalStatus | "all")
    : "pending_admin_review";
}

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const status = normalizeStatus(searchParams?.status);
  const search = searchParams?.q ?? "";
  const requests = await getWithdrawalRequestsForAdmin({ status, search });
  const allRequests = await getWithdrawalRequestsForAdmin({ status: "all" });

  const counts = allRequests.reduce<Record<string, number>>((acc, request) => {
    acc[request.status] = (acc[request.status] ?? 0) + 1;
    acc.all = (acc.all ?? 0) + 1;
    return acc;
  }, {});
  const totalPendingValue = allRequests
    .filter((request) => request.status === "pending_admin_review")
    .reduce((sum, request) => sum + Number(request.amount), 0);

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
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Payout operations
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Withdrawal queue
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Review client payout requests, verify KYC posture, approve
              eligible withdrawals for provider processing, or request more
              information with a recorded note.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:w-[440px]">
            <Metric label="Pending" value={counts.pending_admin_review ?? 0} />
            <Metric label="Approved" value={counts.approved_for_processing ?? 0} />
            <Metric label="Paid" value={(counts.paid ?? 0) + (counts.paid_out ?? 0)} />
            <Metric
              label="Pending Value"
              value={formatCurrency(totalPendingValue, "USD")}
            />
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
                filter.value === "pending_admin_review"
                  ? "/admin/withdrawals"
                  : `/admin/withdrawals?status=${filter.value}`;
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

          <form className="relative w-full lg:w-[420px]">
            <input type="hidden" name="status" value={status} />
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search user, case ID, email, withdrawal ID..."
              className="h-11 rounded-xl border-white/10 bg-white/[0.055] pl-9"
            />
          </form>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.035] p-8 text-center text-sm text-muted-foreground backdrop-blur-xl">
            No withdrawal requests match this view.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {requests.map((request) => (
              <WithdrawalRequestCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function WithdrawalRequestCard({
  request,
}: {
  request: WithdrawalRequestWithRelations;
}) {
  const profile = request.profile;
  const caseRow = request.case;
  const kycStatus = request.kyc?.status ?? profile?.kyc_status ?? "not_started";
  const closed = TERMINAL_STATUSES.has(request.status);
  const method = request.withdrawal_method ?? request.method;

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors hover:border-primary/25 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">
            {profile?.full_name ?? profile?.email ?? "Client request"}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {profile?.email ?? "No email on profile"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={WITHDRAWAL_STATUS_BADGE_VARIANTS[request.status]}>
            {WITHDRAWAL_STATUS_LABELS[request.status]}
          </Badge>
          <Badge variant={KYC_STATUS_BADGE_VARIANTS[kycStatus]}>
            KYC {KYC_STATUS_LABELS[kycStatus]}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
        <Info label="Case" value={caseRow?.case_number ?? request.case_id} />
        <Info label="Method" value={PAYOUT_METHOD_LABELS[method]} />
        <Info label="Amount" value={formatCurrency(request.amount, request.currency)} />
        <Info label="Net" value={formatCurrency(request.net_amount, request.currency)} />
        <Info label="Provider fee" value={formatCurrency(request.provider_fee, request.currency)} />
        <Info label="Provider" value={request.provider ?? "Pending"} />
        <Info
          label="Submitted"
          value={formatDateTime(request.submitted_at ?? request.requested_at)}
        />
        <Info label="Review" value={reviewLabel(request.admin_review_status)} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-background/35 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Destination
        </p>
        <p className="mt-1 break-words text-sm font-medium text-foreground">
          {request.destination_label}
        </p>
      </div>

      {request.admin_notes || request.admin_note ? (
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] p-3 text-sm leading-relaxed text-amber-100">
          {request.admin_notes ?? request.admin_note}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <WithdrawalReviewActions withdrawalId={request.id} disabled={closed} />
        <Button asChild variant="ghost" className="h-11 rounded-xl">
          <Link href={`/admin/cases/${request.case_id}`}>
            Open case file
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function reviewLabel(status: WithdrawalRequestWithRelations["admin_review_status"]) {
  if (status === "needs_more_information") return "Needs Info";
  if (status === "pending_review") return "Pending";
  if (status === "not_started") return "Not Started";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

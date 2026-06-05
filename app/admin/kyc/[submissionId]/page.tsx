import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Fingerprint,
  IdCard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  APP_NAME,
  KYC_ID_TYPE_LABELS,
  KYC_PROOF_TYPE_LABELS,
  KYC_STATUS_BADGE_VARIANTS,
  KYC_STATUS_LABELS,
} from "@/lib/constants";
import {
  getKycAuditLogsForSubmission,
  getKycSubmissionById,
  getSignedKycDocumentUrls,
} from "@/lib/data";
import type { KycAuditLog, KycSubmission } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KycDocumentPreviewGrid } from "@/components/admin/KycDocumentPreviewGrid";
import { KycReviewActions } from "@/components/admin/KycReviewActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `KYC Review · ${APP_NAME}`,
};

export default async function AdminKycDetailPage({
  params,
}: {
  params: { submissionId: string };
}) {
  const submission = await getKycSubmissionById(params.submissionId);
  if (!submission) notFound();

  const [signedUrls, auditLogs] = await Promise.all([
    getSignedKycDocumentUrls(submission),
    getKycAuditLogsForSubmission(submission.id),
  ]);

  const profile = submission.profile;
  const displayName = profile?.full_name ?? submission.full_legal_name;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="rounded-xl">
        <Link href="/admin/kyc">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to KYC queue
        </Link>
      </Button>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              KYC submission
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {displayName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Submission ID {submission.id}. Review identity data, compare
              documents, and record the verification outcome.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-background/35 p-4 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Current status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={KYC_STATUS_BADGE_VARIANTS[submission.status]}>
                {KYC_STATUS_LABELS[submission.status]}
              </Badge>
              {profile?.is_verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/25">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Profile verified
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <KycIdentitySummary submission={submission} />
          <KycDocumentPreviewGrid submission={submission} signedUrls={signedUrls} />
        </div>

        <aside className="space-y-5">
          <KycReviewActions
            submissionId={submission.id}
            currentStatus={submission.status}
          />
          <KycTimeline auditLogs={auditLogs} submission={submission} />
        </aside>
      </div>
    </div>
  );
}

function KycIdentitySummary({ submission }: { submission: KycSubmission }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Identity details
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Personal information
        </h2>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Detail icon={UserRound} label="Legal name" value={submission.full_legal_name} />
        <Detail icon={CalendarDays} label="Date of birth" value={formatDate(submission.date_of_birth)} />
        <Detail icon={Fingerprint} label="Nationality" value={submission.nationality} />
        <Detail icon={MapPin} label="Residential address" value={submission.residential_address} />
        <Detail icon={Phone} label="Phone" value={submission.phone} />
        <Detail icon={Mail} label="Email" value={submission.email} />
        <Detail icon={IdCard} label="ID type" value={KYC_ID_TYPE_LABELS[submission.id_type]} />
        <Detail icon={Fingerprint} label="ID number" value={submission.id_number} />
        <Detail icon={MapPin} label="Issuing country" value={submission.issuing_country} />
        <Detail icon={CalendarDays} label="ID expiry" value={formatDate(submission.id_expiry_date)} />
        <Detail icon={MapPin} label="Address proof" value={KYC_PROOF_TYPE_LABELS[submission.proof_type]} />
        <Detail icon={CalendarDays} label="Submitted" value={formatDateTime(submission.created_at)} />
      </div>
    </section>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-foreground">
            {value || "Not provided"}
          </p>
        </div>
      </div>
    </div>
  );
}

function KycTimeline({
  auditLogs,
  submission,
}: {
  auditLogs: KycAuditLog[];
  submission: KycSubmission;
}) {
  const logs =
    auditLogs.length > 0
      ? auditLogs
      : [
          {
            id: "local-created",
            user_id: submission.user_id,
            submission_id: submission.id,
            action: "submitted" as const,
            actor_id: submission.user_id,
            actor_role: "client" as const,
            notes: "Submission created.",
            created_at: submission.created_at,
          },
        ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Timeline
      </p>
      <h2 className="mt-2 text-xl font-semibold text-foreground">
        Audit activity
      </h2>
      <div className="mt-4 space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-2xl border border-white/10 bg-background/35 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold capitalize text-foreground">
                {log.action.replace(/_/g, " ")}
              </p>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(log.created_at)}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {log.notes ?? "No note recorded."}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  FileCheck2,
  FileSearch,
  FileText,
  FolderKanban,
  IdCard,
  Inbox,
  Lock,
  Mail,
  MessageSquare,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  CASE_STATUS_CONFIG,
  DEMO_MODE,
  KYC_DOCUMENT_STATUS_LABELS,
  KYC_STATUS_LABELS,
  PROVIDER_DISCLAIMER,
  RECOVERY_STAGE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import {
  getCaseParties,
  getCasesForUser,
  getCurrentUserMock,
  getDisputes,
  getFiles,
  getMessages,
  getProfileById,
  getRecoveryOperationsCases,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type {
  CaseParty,
  Dispute,
  EmailLog,
  KycStatus,
  Profile,
  RecoveryCaseStage,
  RecoveryOperationsCase,
  UserRole,
  WithdrawalCondition,
} from "@/lib/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";

type StageTone = {
  border: string;
  bg: string;
  chip: string;
  dot: string;
  glow: string;
  text: string;
};

interface RecoveryCaseCardData {
  operation: RecoveryOperationsCase;
  partyA: string;
  partyB: string;
  filesCount: number;
  messagesCount: number;
  openDispute: Dispute | null;
}

const STAGE_TONE: Record<RecoveryCaseStage, StageTone> = {
  complaint_submitted: {
    border: "border-blue-400/25",
    bg: "bg-blue-400/[0.08]",
    chip: "bg-blue-400/15 text-blue-200 ring-blue-400/25",
    dot: "bg-blue-300",
    glow: "bg-blue-400/20",
    text: "text-blue-200",
  },
  admin_review: {
    border: "border-amber-400/25",
    bg: "bg-amber-400/[0.08]",
    chip: "bg-amber-400/15 text-amber-200 ring-amber-400/25",
    dot: "bg-amber-300",
    glow: "bg-amber-400/20",
    text: "text-amber-200",
  },
  accepted: {
    border: "border-emerald-400/25",
    bg: "bg-emerald-400/[0.08]",
    chip: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    dot: "bg-emerald-300",
    glow: "bg-emerald-400/20",
    text: "text-emerald-200",
  },
  rejected: {
    border: "border-red-400/25",
    bg: "bg-red-400/[0.08]",
    chip: "bg-red-400/15 text-red-200 ring-red-400/25",
    dot: "bg-red-300",
    glow: "bg-red-400/20",
    text: "text-red-200",
  },
  more_evidence_needed: {
    border: "border-orange-400/25",
    bg: "bg-orange-400/[0.08]",
    chip: "bg-orange-400/15 text-orange-200 ring-orange-400/25",
    dot: "bg-orange-300",
    glow: "bg-orange-400/20",
    text: "text-orange-200",
  },
  recovery_in_progress: {
    border: "border-cyan-400/25",
    bg: "bg-cyan-400/[0.08]",
    chip: "bg-cyan-400/15 text-cyan-200 ring-cyan-400/25",
    dot: "bg-cyan-300",
    glow: "bg-cyan-400/20",
    text: "text-cyan-200",
  },
  funds_recovered: {
    border: "border-emerald-400/25",
    bg: "bg-emerald-400/[0.08]",
    chip: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    dot: "bg-emerald-300",
    glow: "bg-emerald-400/20",
    text: "text-emerald-200",
  },
  escrow_funded: {
    border: "border-emerald-400/25",
    bg: "bg-emerald-400/[0.08]",
    chip: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    dot: "bg-emerald-300",
    glow: "bg-emerald-400/20",
    text: "text-emerald-200",
  },
  withdrawal_review: {
    border: "border-sky-400/25",
    bg: "bg-sky-400/[0.08]",
    chip: "bg-sky-400/15 text-sky-200 ring-sky-400/25",
    dot: "bg-sky-300",
    glow: "bg-sky-400/20",
    text: "text-sky-200",
  },
  paid_out: {
    border: "border-slate-400/25",
    bg: "bg-slate-400/[0.08]",
    chip: "bg-slate-400/15 text-slate-200 ring-slate-400/25",
    dot: "bg-slate-300",
    glow: "bg-slate-400/15",
    text: "text-slate-200",
  },
};

const KYC_VARIANT: Record<
  KycStatus,
  "secondary" | "warning" | "success" | "destructive"
> = {
  not_started: "secondary",
  in_review: "warning",
  verified: "success",
  rejected: "destructive",
};

async function resolveUser(): Promise<{
  id?: string;
  role: UserRole;
  name: string;
}> {
  if (DEMO_MODE) {
    const mock = await getCurrentUserMock("client");
    return { id: mock.id, role: mock.role, name: mock.full_name ?? mock.email };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: "client", name: "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return {
    id: profile?.id ?? user.id,
    role: profile?.role ?? "client",
    name: profile?.full_name ?? profile?.email ?? "",
  };
}

async function partyDisplayName(party: CaseParty | undefined): Promise<string> {
  if (!party) return "Invited";
  if (party.profile_id) {
    const profile = await getProfileById(party.profile_id);
    if (profile) return profile.full_name ?? profile.company ?? profile.email;
  }
  return party.invited_email ?? "Invited";
}

export default async function ClientCasesPage() {
  const user = await resolveUser();
  const cases = await getCasesForUser(user.role, user.id);
  const operations = await getRecoveryOperationsCases(user.role, user.id);
  const disputes = await getDisputes();

  const cards: RecoveryCaseCardData[] = await Promise.all(
    operations.map(async (operation) => {
      const [parties, files, messages] = await Promise.all([
        getCaseParties(operation.id),
        getFiles(operation.id),
        getMessages(operation.id),
      ]);
      const [partyA, partyB] = await Promise.all([
        partyDisplayName(parties.find((p) => p.party_role === "party_a")),
        partyDisplayName(parties.find((p) => p.party_role === "party_b")),
      ]);
      const openDispute =
        disputes.find(
          (dispute) =>
            dispute.case_id === operation.id &&
            (dispute.status === "open" || dispute.status === "under_review")
        ) ?? null;

      return {
        operation,
        partyA,
        partyB,
        filesCount: files.length,
        messagesCount: messages.length,
        openDispute,
      };
    })
  );

  if (cards.length === 0) {
    return <EmptyCases firstName={firstName(user.name)} />;
  }

  const primary =
    cards.find((card) => hasRequiredAction(card)) ??
    cards.find((card) => card.operation.recovery_stage !== "paid_out") ??
    cards[0];

  const totalRecovered = operations.reduce(
    (sum, operation) => sum + operation.recovered_amount,
    0
  );
  const evidenceItems = cards.reduce((sum, card) => sum + card.filesCount, 0);
  const reviewQueue = cards.filter((card) =>
    ["admin_review", "more_evidence_needed", "recovery_in_progress"].includes(
      card.operation.recovery_stage
    )
  ).length;
  const kycInReview = operations.filter(
    (operation) => operation.kyc?.status === "in_review"
  ).length;
  const openDisputes = cards.filter((card) => card.openDispute).length;
  const recentEmails = operations
    .flatMap((operation) => operation.email_logs)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const actionItems = buildActionItems(cards);

  return (
    <div className="space-y-6">
      <RecoveryHero
        firstName={firstName(user.name)}
        primary={primary}
        totalCases={cases.length}
        totalRecovered={totalRecovered}
        evidenceItems={evidenceItems}
        reviewQueue={reviewQueue}
        kycInReview={kycInReview}
        openDisputes={openDisputes}
      />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <PrimaryCasePanel card={primary} />
          <CaseRoster cards={cards} />
        </div>

        <aside className="space-y-5">
          <RequiredActionsPanel actions={actionItems} />
          <KycSnapshot card={primary} />
          <AdminUpdatesPanel emails={recentEmails} />
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <EvidenceSummary cards={cards} />
        <RecoveryTrustPanel />
      </section>
    </div>
  );
}

function RecoveryHero({
  firstName,
  primary,
  totalCases,
  totalRecovered,
  evidenceItems,
  reviewQueue,
  kycInReview,
  openDisputes,
}: {
  firstName: string;
  primary: RecoveryCaseCardData;
  totalCases: number;
  totalRecovered: number;
  evidenceItems: number;
  reviewQueue: number;
  kycInReview: number;
  openDisputes: number;
}) {
  const tone = STAGE_TONE[primary.operation.recovery_stage];

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6",
        tone.border
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl",
          tone.glow
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <FileSearch className="h-3.5 w-3.5" />
            Complaint dashboard
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Good morning,</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {firstName}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Track your crypto scam complaint from intake through admin review,
            evidence requests, KYC, recovery progress, and escrow opening.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/register">
                <Plus className="h-4 w-4" />
                Open recovery case
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <Wallet className="h-4 w-4" />
                Open secure escrow account
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-background/35 p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Featured case
          </p>
          <h2 className="mt-2 line-clamp-2 text-xl font-semibold text-foreground">
            {primary.operation.title}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                tone.chip
              )}
            >
              {RECOVERY_STAGE_LABELS[primary.operation.recovery_stage]}
            </span>
            <Badge variant={KYC_VARIANT[primary.operation.kyc?.status ?? "not_started"]}>
              KYC {KYC_STATUS_LABELS[primary.operation.kyc?.status ?? "not_started"]}
            </Badge>
          </div>
          <div className="mt-4">
            <RecoverySegmentProgress stage={primary.operation.recovery_stage} />
          </div>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <HeroMetric
          label="Total cases"
          value={totalCases}
          hint="Complaint files"
          icon={FolderKanban}
          accent="blue"
        />
        <HeroMetric
          label="Evidence"
          value={evidenceItems}
          hint="Uploaded records"
          icon={UploadCloud}
          accent="cyan"
        />
        <HeroMetric
          label="In review"
          value={reviewQueue}
          hint="Admin actions"
          icon={Clock}
          accent="amber"
        />
        <HeroMetric
          label="KYC review"
          value={kycInReview}
          hint="Identity checks"
          icon={IdCard}
          accent="violet"
        />
        <HeroMetric
          label="Recovered"
          value={formatCurrency(totalRecovered, "USD")}
          hint={openDisputes > 0 ? `${openDisputes} dispute active` : "Admin entered"}
          icon={Wallet}
          accent={openDisputes > 0 ? "rose" : "emerald"}
        />
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  accent: "blue" | "cyan" | "amber" | "violet" | "emerald" | "rose";
}) {
  const accentClass = {
    blue: "bg-blue-400/15 text-blue-200 ring-blue-400/25",
    cyan: "bg-cyan-400/15 text-cyan-200 ring-cyan-400/25",
    amber: "bg-amber-400/15 text-amber-200 ring-amber-400/25",
    violet: "bg-violet-400/15 text-violet-200 ring-violet-400/25",
    emerald: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    rose: "bg-rose-400/15 text-rose-200 ring-rose-400/25",
  }[accent];

  return (
    <div className="min-h-[142px] rounded-2xl border border-white/10 bg-background/35 p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            accentClass
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PrimaryCasePanel({ card }: { card: RecoveryCaseCardData }) {
  const { operation } = card;
  const tone = STAGE_TONE[operation.recovery_stage];
  const unsatisfied = operation.withdrawal_conditions.filter(
    (condition) => !condition.satisfied
  );

  return (
    <section
      className={cn(
        "rounded-3xl border bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6",
        tone.border
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {operation.case_number}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Active recovery file
          </h2>
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {operation.description ?? operation.title}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/cases/${operation.id}`}>
            Open workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
          <RecoveryTimeline stage={operation.recovery_stage} />
        </div>

        <div className="space-y-3">
          <MiniStatus
            label="Case decision"
            value={decisionLabel(operation)}
            icon={FileCheck2}
            tone={operation.recovery_stage === "rejected" ? "danger" : "normal"}
          />
          <MiniStatus
            label="Evidence on file"
            value={`${card.filesCount} uploads`}
            icon={UploadCloud}
            tone={card.filesCount === 0 ? "warning" : "normal"}
          />
          <MiniStatus
            label="Messages"
            value={`${card.messagesCount} case notes`}
            icon={MessageSquare}
            tone="normal"
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CaseFact
          label="KYC"
          value={KYC_STATUS_LABELS[operation.kyc?.status ?? "not_started"]}
          icon={IdCard}
        />
        <CaseFact
          label="Recovered funds"
          value={formatCurrency(operation.recovered_amount, "USD")}
          icon={Wallet}
          accent
        />
        <CaseFact
          label="Required conditions"
          value={
            unsatisfied.length > 0
              ? `${unsatisfied.length} open`
              : "None blocking"
          }
          icon={ShieldCheck}
        />
      </div>
    </section>
  );
}

function RecoveryTimeline({ stage }: { stage: RecoveryCaseStage }) {
  const activeStep = recoveryStep(stage);
  const steps = [
    { label: "Complaint", icon: Inbox },
    { label: "Evidence", icon: UploadCloud },
    { label: "Admin review", icon: FileSearch },
    { label: "KYC", icon: IdCard },
    { label: "Recovery", icon: ShieldCheck },
    { label: "Escrow", icon: Wallet },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Recovery progress
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {RECOVERY_STAGE_LABELS[stage]}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-muted-foreground">
          Step {activeStep} of {steps.length}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, index) => {
          const done = index + 1 <= activeStep;
          const Icon = step.icon;
          return (
            <div key={step.label} className="min-w-0">
              <div
                className={cn(
                  "flex h-12 w-full items-center justify-center rounded-2xl border",
                  done
                    ? "border-primary/25 bg-primary/15 text-primary"
                    : "border-white/10 bg-white/[0.035] text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p
                className={cn(
                  "mt-2 truncate text-center text-xs font-medium",
                  done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStatus({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "normal" | "warning" | "danger";
}) {
  const toneClass = {
    normal: "border-white/10 bg-white/[0.045] text-primary",
    warning: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
    danger: "border-red-400/25 bg-red-400/[0.08] text-red-200",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-3", toneClass)}>
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold text-foreground">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function CaseFact({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4", accent ? "text-emerald-200" : "text-primary")} />
      </div>
      <p className="mt-3 truncate text-lg font-semibold text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

function RequiredActionsPanel({
  actions,
}: {
  actions: ReturnType<typeof buildActionItems>;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Required actions
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Client tasks
          </h2>
        </div>
        <Bell className="h-5 w-5 text-primary" />
      </div>

      <div className="mt-4 space-y-2">
        {actions.length === 0 ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4">
            <p className="text-sm font-semibold text-foreground">
              No client blockers
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Admin review is continuing. You will see new requests here.
            </p>
          </div>
        ) : (
          actions.slice(0, 5).map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={`${action.caseId}-${action.label}`}
                href={`/dashboard/cases/${action.caseId}`}
                className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-background/35 p-3 transition-colors hover:border-primary/35 hover:bg-primary/10"
              >
                <span
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                    action.urgent
                      ? "bg-orange-400/15 text-orange-200 ring-orange-400/25"
                      : "bg-primary/15 text-primary ring-primary/25"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                    {action.hint}
                  </span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function KycSnapshot({ card }: { card: RecoveryCaseCardData }) {
  const kyc = card.operation.kyc;
  const status = kyc?.status ?? "not_started";
  const checks = [
    {
      label: "Government ID",
      value: kyc ? KYC_DOCUMENT_STATUS_LABELS[kyc.government_id_status] : "Not Submitted",
      complete: kyc?.government_id_status === "verified",
    },
    {
      label: "Selfie",
      value: kyc ? KYC_DOCUMENT_STATUS_LABELS[kyc.selfie_status] : "Not Submitted",
      complete: kyc?.selfie_status === "verified",
    },
    {
      label: "Address",
      value: kyc ? KYC_DOCUMENT_STATUS_LABELS[kyc.proof_of_address_status] : "Not Submitted",
      complete: kyc?.proof_of_address_status === "verified",
    },
    {
      label: "Phone",
      value: kyc?.phone_verified ? "Verified" : "Not Verified",
      complete: Boolean(kyc?.phone_verified),
    },
    {
      label: "Email",
      value: kyc?.email_verified ? "Verified" : "Not Verified",
      complete: Boolean(kyc?.email_verified),
    },
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            KYC
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Identity review
          </h2>
        </div>
        <Badge variant={KYC_VARIANT[status]}>
          {KYC_STATUS_LABELS[status]}
        </Badge>
      </div>

      <div className="mt-4 space-y-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/35 px-3 py-2"
          >
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                check.complete
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-amber-400/15 text-amber-200"
              )}
            >
              {check.complete ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {check.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {check.value}
              </span>
            </span>
          </div>
        ))}
      </div>

      {kyc?.review_note ? (
        <p className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.07] p-3 text-xs leading-relaxed text-muted-foreground">
          {kyc.review_note}
        </p>
      ) : null}
    </section>
  );
}

function AdminUpdatesPanel({ emails }: { emails: EmailLog[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Admin updates
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Email records
          </h2>
        </div>
        <Mail className="h-5 w-5 text-primary" />
      </div>

      <div className="mt-4 space-y-2">
        {emails.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-background/35 p-4 text-sm text-muted-foreground">
            No admin email updates yet.
          </p>
        ) : (
          emails.slice(0, 4).map((email) => (
            <div
              key={email.id}
              className="rounded-2xl border border-white/10 bg-background/35 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                  <Mail className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-foreground">
                    {email.subject}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {email.status.replace(/_/g, " ")} ·{" "}
                    {formatDateTime(email.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function CaseRoster({ cards }: { cards: RecoveryCaseCardData[] }) {
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Case roster"
        title="All recovery files"
        subtitle="Open any complaint file to upload evidence, message the assigned team, or review the escrow workspace."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <RecoveryCaseCard key={card.operation.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function RecoveryCaseCard({ card }: { card: RecoveryCaseCardData }) {
  const { operation } = card;
  const tone = STAGE_TONE[operation.recovery_stage];
  const statusConfig = CASE_STATUS_CONFIG[operation.status];
  const withdrawal = operation.withdrawal_request;

  return (
    <Link
      href={`/dashboard/cases/${operation.id}`}
      className={cn(
        "group block rounded-2xl border bg-white/[0.055] p-4 shadow-xl shadow-black/10 backdrop-blur-xl transition-colors hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {operation.case_number}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-foreground">
            {operation.title}
          </h3>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
            tone.chip
          )}
        >
          {RECOVERY_STAGE_LABELS[operation.recovery_stage]}
        </span>
        {statusConfig ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              statusConfig.badgeClass
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dotClass)}
            />
            {statusConfig.label}
          </span>
        ) : null}
        {operation.escrow ? (
          <EscrowStatusBadge status={operation.escrow.escrow_status} />
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <RosterMetric label="Evidence" value={`${card.filesCount} uploads`} />
        <RosterMetric
          label="KYC"
          value={KYC_STATUS_LABELS[operation.kyc?.status ?? "not_started"]}
        />
        <RosterMetric
          label="Recovered"
          value={formatCurrency(operation.recovered_amount, "USD")}
          accent
        />
        <RosterMetric
          label="Withdrawal"
          value={
            withdrawal
              ? WITHDRAWAL_STATUS_LABELS[withdrawal.status]
              : "Not Requested"
          }
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {card.partyA} / {card.partyB}
          </span>
        </span>
        <span>Updated {formatDate(operation.updated_at)}</span>
      </div>
    </Link>
  );
}

function RosterMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/35 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-semibold",
          accent ? "text-emerald-200" : "text-foreground"
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function EvidenceSummary({ cards }: { cards: RecoveryCaseCardData[] }) {
  const topCases = [...cards]
    .sort((a, b) => b.filesCount - a.filesCount)
    .slice(0, 4);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <SectionHeader
        eyebrow="Evidence library"
        title="Uploaded complaint records"
        subtitle="Evidence counts across screenshots, receipts, transaction hashes, chat logs, and related documents."
      />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {topCases.map((card) => (
          <Link
            key={card.operation.id}
            href={`/dashboard/cases/${card.operation.id}`}
            className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-background/35 p-3 transition-colors hover:border-primary/35 hover:bg-primary/10"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
              <FileText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {card.operation.case_number}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {card.filesCount} evidence item
                {card.filesCount === 1 ? "" : "s"} on file
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecoveryTrustPanel() {
  return (
    <aside className="rounded-3xl border border-primary/15 bg-primary/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-foreground">
            Case review is separate from fund release
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Admins review your complaint, request evidence, verify KYC, and
            record updates. Escrow balances and withdrawals remain controlled by
            protected admin and provider workflows. {PROVIDER_DISCLAIMER}
          </p>
        </div>
      </div>
    </aside>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function EmptyCases({ firstName }: { firstName: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-xl">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <FolderKanban className="h-8 w-8" />
      </div>
      <p className="text-sm text-muted-foreground">Good morning, {firstName}</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">
        No recovery complaints yet
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Open a recovery complaint and it will appear here after intake. You can
        upload evidence, complete review steps, and track admin updates.
      </p>
      <Button asChild className="mt-5">
        <Link href="/register">
          <Plus className="h-4 w-4" />
          Open recovery case
        </Link>
      </Button>
    </section>
  );
}

function buildActionItems(cards: RecoveryCaseCardData[]) {
  return cards.flatMap((card) => {
    const operation = card.operation;
    const actions: Array<{
      caseId: string;
      label: string;
      hint: string;
      icon: LucideIcon;
      urgent: boolean;
    }> = [];

    if (operation.recovery_stage === "more_evidence_needed") {
      actions.push({
        caseId: operation.id,
        label: "Upload requested evidence",
        hint: operation.kyc?.review_note ?? "Admin needs more documents before continuing review.",
        icon: UploadCloud,
        urgent: true,
      });
    }

    if (card.filesCount === 0) {
      actions.push({
        caseId: operation.id,
        label: "Add scam evidence",
        hint: "Upload transaction hashes, screenshots, receipts, wallet addresses, and chat logs.",
        icon: FileText,
        urgent: true,
      });
    }

    if ((operation.kyc?.status ?? "not_started") !== "verified") {
      actions.push({
        caseId: operation.id,
        label: "Complete KYC review",
        hint: operation.kyc?.review_note ?? "Identity verification is required before withdrawal approval.",
        icon: IdCard,
        urgent: operation.kyc?.status === "rejected",
      });
    }

    const openConditions = operation.withdrawal_conditions.filter(
      (condition) => !condition.satisfied
    );
    if (openConditions.length > 0) {
      actions.push({
        caseId: operation.id,
        label: `${openConditions.length} admin condition${
          openConditions.length === 1 ? "" : "s"
        } open`,
        hint: openConditions.map((condition) => condition.label).join(", "),
        icon: ShieldAlert,
        urgent: true,
      });
    }

    if (card.openDispute) {
      actions.push({
        caseId: operation.id,
        label: "Dispute under review",
        hint: card.openDispute.reason,
        icon: AlertTriangle,
        urgent: true,
      });
    }

    return actions;
  });
}

function hasRequiredAction(card: RecoveryCaseCardData): boolean {
  return buildActionItems([card]).length > 0;
}

function recoveryStep(stage: RecoveryCaseStage): number {
  if (stage === "paid_out" || stage === "withdrawal_review" || stage === "escrow_funded") {
    return 6;
  }
  if (stage === "funds_recovered" || stage === "recovery_in_progress") {
    return 5;
  }
  if (stage === "accepted") {
    return 4;
  }
  if (stage === "admin_review" || stage === "rejected") {
    return 3;
  }
  if (stage === "more_evidence_needed") {
    return 2;
  }
  return 1;
}

function RecoverySegmentProgress({ stage }: { stage: RecoveryCaseStage }) {
  const step = recoveryStep(stage);
  const total = 6;
  const tone = STAGE_TONE[stage];

  return (
    <div>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full",
              index + 1 <= step ? tone.dot : "bg-white/10"
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Step {step} of {total}: {RECOVERY_STAGE_LABELS[stage]}
      </p>
    </div>
  );
}

function decisionLabel(operation: RecoveryOperationsCase): string {
  if (operation.recovery_stage === "rejected") return "Rejected";
  if (
    ["accepted", "recovery_in_progress", "funds_recovered", "escrow_funded", "withdrawal_review", "paid_out"].includes(
      operation.recovery_stage
    )
  ) {
    return "Accepted";
  }
  if (operation.recovery_stage === "more_evidence_needed") {
    return "More evidence needed";
  }
  return "Pending admin review";
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || "there";
}

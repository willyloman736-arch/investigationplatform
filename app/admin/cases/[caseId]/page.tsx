// ─────────────────────────────────────────────────────────────────────────────
// Admin case detail — full control surface for one case.
//
// Server Component. Loads everything for the case and composes:
//   • Header: case meta, status, party assignments, quick admin actions
//     (RequestEvidenceDialog, FlagActivityDialog)
//   • Contract verification (ContractVerificationPanel → signContract)
//   • Evidence review (file list with open links)
//   • Escrow ledger (FundsBreakdownTable row + append-only transactions)
//   • Escrow controls (EscrowControlPanel → reason-gated admin actions; release
//     only via the protected server route)
//   • Dispute review (AdminDisputePanel)
//   • Full audit timeline (AuditLogTimeline)
//
// Compliance is reinforced throughout: the admin governs status/eligibility and
// review; funds move only through the licensed provider after confirmation, and
// every action is audited. No money movement happens on this page.
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Paperclip,
  ScrollText,
  Wallet,
  ShieldCheck,
  Lock,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn, formatCurrency, formatDateTime, formatDate } from "@/lib/utils";
import {
  APP_NAME,
  CASE_STATUS_CONFIG,
  DEPOSIT_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
  FILE_CATEGORY_LABELS,
  PROVIDER_DISCLAIMER,
} from "@/lib/constants";
import {
  getCaseById,
  getEscrow,
  getFiles,
  getTransactions,
  getApprovals,
  getCaseParties,
  getDisputes,
  getAuditLogs,
  getProfileById,
  getRecoveryCaseOperations,
} from "@/lib/data";
import type {
  AuditLog,
  CaseParty,
  EscrowTransaction,
  FundsBreakdownRow,
  Profile,
  UploadedFile,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";
import { AuditLogTimeline } from "@/components/shared/AuditLogTimeline";
import { FundsBreakdownTable } from "@/components/dashboard/FundsBreakdownTable";
import { EscrowControlPanel } from "@/components/admin/EscrowControlPanel";
import { AdminDisputePanel } from "@/components/admin/AdminDisputePanel";
import { RequestEvidenceDialog } from "@/components/admin/RequestEvidenceDialog";
import { FlagActivityDialog } from "@/components/admin/FlagActivityDialog";
import { ContractVerificationPanel } from "@/components/admin/ContractVerificationPanel";
import { RecoveryCaseOperationsPanel } from "@/components/admin/RecoveryCaseOperationsPanel";
import { Icon3D, type Icon3DTone } from "@/components/shared/Icon3D";

interface PageProps {
  params: { caseId: string };
}

export async function generateMetadata({ params }: PageProps) {
  const caseRow = await getCaseById(params.caseId);
  return {
    title: caseRow
      ? `${caseRow.case_number} · ${APP_NAME}`
      : `Case · ${APP_NAME}`,
  };
}

function nameForProfile(p: Profile | null | undefined): string {
  if (!p) return "—";
  return p.full_name ?? p.company ?? p.email;
}

function partyDisplay(
  party: CaseParty | undefined,
  profiles: Map<string, Profile | null>
): string {
  if (!party) return "Unassigned";
  if (party.profile_id) {
    const p = profiles.get(party.profile_id);
    if (p) return nameForProfile(p);
  }
  return party.invited_email ?? "Invited";
}

export default async function AdminCaseDetailPage({ params }: PageProps) {
  const { caseId } = params;
  const caseRow = await getCaseById(caseId);
  if (!caseRow) notFound();

  const [
    escrow,
    files,
    transactions,
    approvals,
    parties,
    disputes,
    auditLogs,
    recoveryOperation,
  ] = await Promise.all([
      getEscrow(caseId),
      getFiles(caseId),
      getTransactions(caseId),
      getApprovals(caseId),
      getCaseParties(caseId),
      getDisputes(),
      getAuditLogs(caseId),
      getRecoveryCaseOperations(caseId),
    ]);

  // Resolve profiles referenced by parties, files, transactions, and audit logs.
  const profileIds = new Set<string>();
  parties.forEach((p) => p.profile_id && profileIds.add(p.profile_id));
  files.forEach((f) => f.uploaded_by && profileIds.add(f.uploaded_by));
  transactions.forEach((t) => t.initiated_by && profileIds.add(t.initiated_by));
  auditLogs.forEach((l) => l.actor_id && profileIds.add(l.actor_id));
  if (caseRow.created_by) profileIds.add(caseRow.created_by);
  if (caseRow.assigned_admin) profileIds.add(caseRow.assigned_admin);

  const profileEntries = await Promise.all(
    Array.from(profileIds).map(
      async (id) => [id, await getProfileById(id)] as const
    )
  );
  const profiles = new Map<string, Profile | null>(profileEntries);

  const resolveActor = (id: string | null): string | undefined => {
    if (!id) return "System";
    return nameForProfile(profiles.get(id)) || "Participant";
  };

  const partyA = parties.find((p) => p.party_role === "party_a");
  const partyB = parties.find((p) => p.party_role === "party_b");
  const partyAProfile = partyA?.profile_id
    ? profiles.get(partyA.profile_id)
    : null;
  const clientEmail =
    partyAProfile?.email ?? partyA?.invited_email ?? "client@example.com";
  const caseDispute =
    disputes.find((d) => d.case_id === caseId) ?? null;

  const statusConfig = CASE_STATUS_CONFIG[caseRow.status];

  // Single funds-breakdown row for this case.
  const fundsRow: FundsBreakdownRow | null = escrow
    ? {
        caseId: caseRow.id,
        caseNumber: caseRow.case_number,
        client: partyDisplay(partyA, profiles),
        counterparty: partyDisplay(partyB, profiles),
        total: escrow.total_amount,
        platformFee: escrow.platform_fee,
        providerFee: escrow.provider_fee,
        netRelease: escrow.net_release_amount,
        currency: escrow.currency,
        depositStatus: escrow.deposit_status,
        escrowStatus: escrow.escrow_status,
        releaseStatus: escrow.release_status,
        lastUpdated: escrow.updated_at,
      }
    : null;

  const approvedCount = approvals.filter((a) => a.approved).length;

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/cases">
            <ArrowLeft className="h-4 w-4" />
            All cases
          </Link>
        </Button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {caseRow.case_number}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                  statusConfig.badgeClass
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dotClass)}
                />
                {statusConfig.label}
              </span>
              {escrow && <EscrowStatusBadge status={escrow.escrow_status} />}
              {caseRow.category && (
                <Badge variant="outline">{caseRow.category}</Badge>
              )}
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {caseRow.title}
            </h1>
            {caseRow.description && (
              <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
                {caseRow.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Opened {formatDate(caseRow.created_at)} · Last updated{" "}
              {formatDateTime(caseRow.updated_at)}
            </p>
          </div>

          {/* Quick admin review actions */}
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <RequestEvidenceDialog caseId={caseId} />
            <FlagActivityDialog caseId={caseId} />
          </div>
        </div>
      </div>

      {/* Compliance banner */}
      <Alert className="border-primary/30 bg-primary/[0.06]">
        <Lock className="h-4 w-4" />
        <AlertTitle className="text-foreground">
          You control the workflow — not the money
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Release requires both parties to approve, or a dispute resolved to
          release with eligibility marked. It executes server-side only after the
          licensed provider confirms. Status overrides require a reason and are
          audited. {PROVIDER_DISCLAIMER}
        </AlertDescription>
      </Alert>

      {/* Parties + approvals snapshot */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          icon={Users}
          label="Client"
          tone="blue"
          value={partyDisplay(partyA, profiles)}
          sub={
            partyA?.accepted
              ? "Accepted"
              : partyA
                ? "Invited — pending"
                : undefined
          }
        />
        <InfoCard
          icon={Users}
          label="Operator"
          tone="cyan"
          value={partyDisplay(partyB, profiles)}
          sub={
            partyB?.accepted
              ? "Accepted"
              : partyB
                ? "Invited — pending"
                : undefined
          }
        />
        <InfoCard
          icon={ShieldCheck}
          label="Release approvals"
          tone="emerald"
          value={`${approvedCount} / 2`}
          sub={
            approvedCount === 2
              ? "Both parties approved"
              : "Admin review required"
          }
        />
        <InfoCard
          icon={Wallet}
          label="Net withdrawal"
          tone="violet"
          value={
            escrow
              ? formatCurrency(escrow.net_release_amount, escrow.currency)
              : "—"
          }
          sub={escrow ? RELEASE_STATUS_LABELS[escrow.release_status] : undefined}
          accent
        />
      </section>

      {/* Two-column working area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recovery operations */}
          {recoveryOperation ? (
            <RecoveryCaseOperationsPanel
              operation={recoveryOperation}
              clientEmail={clientEmail}
            />
          ) : null}

          {/* Contract verification */}
          <ContractVerificationPanel case={caseRow} />

          {/* Evidence review */}
          <EvidenceReview files={files} profiles={profiles} />

          {/* Escrow ledger */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              Escrow ledger
            </h3>
            {fundsRow ? (
              <FundsBreakdownTable
                rows={[fundsRow]}
                caption={`Deposit: ${
                  DEPOSIT_STATUS_LABELS[fundsRow.depositStatus]
                } · Amounts are display-only. ${PROVIDER_DISCLAIMER}`}
              />
            ) : (
              <Alert variant="warning">
                <Wallet className="h-4 w-4" />
                <AlertTitle>No escrow account</AlertTitle>
                <AlertDescription>
                  This case has no escrow account yet.
                </AlertDescription>
              </Alert>
            )}
            <TransactionLedger
              transactions={transactions}
              resolveActor={resolveActor}
            />
          </section>

          {/* Dispute review */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ScrollText className="h-4 w-4 text-primary" />
              Dispute review
            </h3>
            <AdminDisputePanel
              dispute={caseDispute}
              caseId={caseId}
              caseNumber={caseRow.case_number}
            />
          </section>
        </div>

        {/* Right rail: escrow controls */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <EscrowControlPanel case={caseRow} escrow={escrow} />
          </div>
        </aside>
      </div>

      {/* Full audit trail */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ScrollText className="h-4 w-4 text-primary" />
            Audit trail
          </h3>
          <span className="text-xs text-muted-foreground">
            {auditLogs.length} {auditLogs.length === 1 ? "event" : "events"}
          </span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-md sm:p-6">
          <AuditLogTimeline items={auditLogs} resolveActor={resolveActor} />
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  tone?: Icon3DTone;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon3D icon={Icon} tone={tone} size={34} />
      </div>
      <p
        className={cn(
          "mt-2 truncate text-lg font-semibold tracking-tight",
          accent ? "text-cyan-300" : "text-foreground"
        )}
        title={value}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function EvidenceReview({
  files,
  profiles,
}: {
  files: UploadedFile[];
  profiles: Map<string, Profile | null>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Paperclip className="h-4 w-4 text-primary" />
          Evidence
        </h3>
        <span className="text-xs text-muted-foreground">
          {files.length} {files.length === 1 ? "file" : "files"}
        </span>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
            <FileText className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">
            No evidence uploaded
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Files submitted by either party for review will appear here. Use
            “Request evidence” to ask for more.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => {
            const uploader = profiles.get(file.uploaded_by);
            return (
              <li
                key={file.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-card/60 p-3 backdrop-blur-md"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.file_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {FILE_CATEGORY_LABELS[file.file_type]} ·{" "}
                    {formatBytes(file.size_bytes)} · by{" "}
                    {nameForProfile(uploader)} · {formatDate(file.created_at)}
                  </p>
                  {file.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                      {file.notes}
                    </p>
                  )}
                </div>
                {file.file_url ? (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Stored
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TransactionLedger({
  transactions,
  resolveActor,
}: {
  transactions: EscrowTransaction[];
  resolveActor: (id: string | null) => string | undefined;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center">
        <p className="text-sm font-medium text-foreground">
          No provider-confirmed transactions yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Deposits, fees, and releases confirmed by the licensed provider appear
          here as an append-only ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md">
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="whitespace-nowrap">Type</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Amount
              </TableHead>
              <TableHead className="whitespace-nowrap">Provider ref</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Initiated by</TableHead>
              <TableHead className="whitespace-nowrap">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} className="border-white/5">
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize text-foreground">
                    {t.type}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                  {formatCurrency(t.amount, t.currency)}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {t.provider_reference ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <TxnStatusBadge status={t.status} providerStatus={t.provider_status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {resolveActor(t.initiated_by)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(t.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="border-t border-white/10 px-4 py-2.5 text-[11px] text-muted-foreground">
        Append-only ledger of provider-confirmed events. The app records status —
        it never computes balances or moves funds.
      </p>
    </div>
  );
}

function TxnStatusBadge({
  status,
  providerStatus,
}: {
  status: EscrowTransaction["status"];
  providerStatus: string | null;
}) {
  const variant =
    status === "confirmed"
      ? "success"
      : status === "failed"
        ? "destructive"
        : "warning";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={variant}>{label}</Badge>
      {providerStatus && (
        <span className="text-[11px] text-muted-foreground">
          {providerStatus}
        </span>
      )}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

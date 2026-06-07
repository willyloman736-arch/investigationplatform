// ─────────────────────────────────────────────────────────────────────────────
// Client case workspace (Server Component).
//
// Two-tab workspace for a single case:
//   1. "Intake & Case Management" — case summary + contract terms, FileUploader,
//      uploaded-files list, and the SecureChat channel.
//   2. "Escrow Ledger" — escrow status, a per-case FundsBreakdownTable, the
//      dual-party ApprovalPanel, the append-only escrow_transactions ledger, and
//      the case AuditLogTimeline.
//
// The page fetches everything via @/lib/data and passes plain data into the
// interactive client components. It NEVER triggers a release or moves money —
// approvals are recorded by server actions, and release runs server-side only.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  Info,
  Receipt,
  ScrollText,
  ShieldCheck,
  Tag,
  Users,
  Wallet,
} from "lucide-react";

import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  CASE_STATUS_CONFIG,
  CASE_TABS,
  DEMO_MODE,
  DEPOSIT_STATUS_LABELS,
  FILE_CATEGORY_LABELS,
  PROVIDER_DISCLAIMER,
  RELEASE_STATUS_LABELS,
} from "@/lib/constants";
import {
  getApprovals,
  getAuditLogs,
  getCaseById,
  getCaseParties,
  getCasesForUser,
  getCurrentUserMock,
  getEscrow,
  getFiles,
  getMessages,
  getProfileById,
  getRecoveryCaseOperations,
  getTransactions,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type {
  CaseParty,
  EscrowContract,
  FundsBreakdownRow,
  PartyRole,
  Profile,
  RecoveryOperationsCase,
  UserRole,
} from "@/lib/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { FileUploader } from "@/components/dashboard/FileUploader";
import { SecureChat } from "@/components/dashboard/SecureChat";
import { ApprovalPanel } from "@/components/dashboard/ApprovalPanel";
import { WithdrawalRequestDialog } from "@/components/dashboard/WithdrawalRequestDialog";

async function resolveUser(): Promise<{ id?: string; role: UserRole }> {
  if (DEMO_MODE) {
    const mock = await getCurrentUserMock("client");
    return { id: mock.id, role: mock.role };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: "client" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  return { id: profile?.id ?? user.id, role: profile?.role ?? "client" };
}

function displayName(profile: Profile | null, party?: CaseParty): string {
  if (profile) return profile.full_name ?? profile.company ?? profile.email;
  if (party) return party.invited_email ?? "Invited";
  return "—";
}

function toBreakdownRow(
  caseNumber: string,
  escrow: EscrowContract,
  partyA: string,
  partyB: string,
  fallbackUpdated: string
): FundsBreakdownRow {
  return {
    caseId: escrow.case_id,
    caseNumber,
    client: partyA,
    counterparty: partyB,
    total: escrow.total_amount,
    platformFee: escrow.platform_fee,
    providerFee: escrow.provider_fee,
    netRelease: escrow.net_release_amount,
    currency: escrow.currency,
    depositStatus: escrow.deposit_status,
    escrowStatus: escrow.escrow_status,
    releaseStatus: escrow.release_status,
    lastUpdated: escrow.updated_at ?? fallbackUpdated,
  };
}

export default async function CaseWorkspacePage({
  params,
}: {
  params: { caseId: string };
}) {
  const { caseId } = params;
  const user = await resolveUser();

  const caseRow = await getCaseById(caseId);
  if (!caseRow) notFound();

  // Access guard (defense in depth; RLS enforces this in production too).
  // Admins see all; non-admins must be a party on the case.
  if (user.role !== "admin") {
    const visible = await getCasesForUser(user.role, user.id);
    if (!visible.some((c) => c.id === caseId)) {
      notFound();
    }
  }

  // Fetch every related slice in parallel.
  const [parties, escrow, files, messages, approvals, transactions, audit, operation] =
    await Promise.all([
      getCaseParties(caseId),
      getEscrow(caseId),
      getFiles(caseId),
      getMessages(caseId),
      getApprovals(caseId),
      getTransactions(caseId),
      getAuditLogs(caseId),
      getRecoveryCaseOperations(caseId),
    ]);

  // Resolve party display names + the signed-in user's party role.
  const partyARow = parties.find((p) => p.party_role === "party_a");
  const partyBRow = parties.find((p) => p.party_role === "party_b");
  const [partyAProfile, partyBProfile] = await Promise.all([
    partyARow?.profile_id ? getProfileById(partyARow.profile_id) : Promise.resolve(null),
    partyBRow?.profile_id ? getProfileById(partyBRow.profile_id) : Promise.resolve(null),
  ]);
  const partyAName = displayName(partyAProfile, partyARow);
  const partyBName = displayName(partyBProfile, partyBRow);

  const currentParty: PartyRole | null =
    parties.find((p) => p.profile_id === user.id)?.party_role ?? null;
  const currentUserId = user.id ?? "";

  // Sender-name lookup for the chat (profile_id → display name).
  const senderNames: Record<string, string> = {};
  if (partyARow?.profile_id && partyAProfile)
    senderNames[partyARow.profile_id] = partyAName;
  if (partyBRow?.profile_id && partyBProfile)
    senderNames[partyBRow.profile_id] = partyBName;
  if (caseRow.assigned_admin) {
    const adminProfile = await getProfileById(caseRow.assigned_admin);
    if (adminProfile)
      senderNames[caseRow.assigned_admin] =
        adminProfile.full_name ?? "Case Team";
  }

  // Actor-name resolver for the audit timeline.
  const resolveActor = (id: string | null): string | undefined =>
    id ? senderNames[id] : undefined;

  const statusConfig = CASE_STATUS_CONFIG[caseRow.status];
  const rows: FundsBreakdownRow[] = escrow
    ? [toBreakdownRow(caseRow.case_number, escrow, partyAName, partyBName, caseRow.updated_at)]
    : [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/cases"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All cases
      </Link>

      {/* Case header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {caseRow.case_number}
          </span>
          {statusConfig ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
                statusConfig.badgeClass
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dotClass)}
                aria-hidden="true"
              />
              {statusConfig.label}
            </span>
          ) : null}
          {escrow ? <EscrowStatusBadge status={escrow.escrow_status} /> : null}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {caseRow.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {caseRow.category ? (
            <span className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              {caseRow.category}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {partyAName} ↔ {partyBName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Updated {formatDate(caseRow.updated_at)}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="intake" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="intake" className="gap-1.5">
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{CASE_TABS.intake.label}</span>
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5">
            <Wallet className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{CASE_TABS.ledger.label}</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Intake & Case Management ─────────────────────────────── */}
        <TabsContent value="intake" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left column: summary + uploader + files */}
            <div className="space-y-6 lg:col-span-2">
              <CaseSummaryCard
                description={caseRow.description}
                contractTerms={caseRow.contract_terms}
                signedByA={caseRow.contract_signed_by_a}
                signedByB={caseRow.contract_signed_by_b}
                partyAName={partyAName}
                partyBName={partyBName}
              />

              {/* Evidence uploader */}
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                  Upload evidence
                </h2>
                <FileUploader caseId={caseId} />
              </section>

              {/* Uploaded files */}
              <section className="space-y-3">
                <h2 className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
                    Evidence on file
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {files.length} {files.length === 1 ? "item" : "items"}
                  </span>
                </h2>

                {files.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      No evidence uploaded yet
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload receipts, logs, or transaction references above to
                      build the case record.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md">
                    {files.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-start gap-3 p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
                          <FileText className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {file.file_name}
                            </p>
                            <Badge variant="secondary" className="shrink-0">
                              {FILE_CATEGORY_LABELS[file.file_type]}
                            </Badge>
                          </div>
                          {file.notes ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {file.notes}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatBytes(file.size_bytes)} ·{" "}
                            {formatDateTime(file.created_at)}
                          </p>
                        </div>
                        <Link
                          href={`/api/evidence/${file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/10 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.055] hover:text-foreground"
                        >
                          Open
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Right column: secure chat */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-6">
                <SecureChat
                  caseId={caseId}
                  messages={messages}
                  currentUserId={currentUserId}
                  senderNames={senderNames}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Tab 2: Escrow Ledger ────────────────────────────────────────── */}
        <TabsContent value="ledger" className="space-y-6">
          {escrow ? (
            <>
              {/* Status overview strip */}
              <EscrowOverviewStrip escrow={escrow} operation={operation} />

              {/* Per-case funds breakdown */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Fee breakdown
                </h2>
                <FundsBreakdownTable rows={rows} caption={PROVIDER_DISCLAIMER} />
              </section>

              {/* Approvals */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Release approvals
                </h2>
                <ApprovalPanel
                  caseId={caseId}
                  approvals={approvals}
                  escrowStatus={escrow.escrow_status}
                  currentParty={currentParty}
                />
              </section>

              {/* Transaction ledger */}
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ScrollText className="h-4 w-4 text-primary" aria-hidden="true" />
                  Transaction ledger
                </h2>
                <p className="text-xs text-muted-foreground">
                  Append-only record of provider-confirmed events. Digital Asset Investigations never
                  moves funds itself; entries reflect the licensed partner.
                </p>
                <TransactionLedger
                  transactions={transactions}
                  resolveActor={resolveActor}
                />
              </section>

              {/* Audit timeline */}
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ScrollText className="h-4 w-4 text-primary" aria-hidden="true" />
                  Case audit trail
                </h2>
                <div className="rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md sm:p-6">
                  <AuditLogTimeline items={audit} resolveActor={resolveActor} />
                </div>
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Wallet className="h-7 w-7" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                No escrow account yet
              </h2>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                Once an escrow account is created for this case, its fee
                breakdown, approvals, and ledger will appear here.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Subcomponents (presentational, in-file) ──────────────────────────────────

function CaseSummaryCard({
  description,
  contractTerms,
  signedByA,
  signedByB,
  partyAName,
  partyBName,
}: {
  description: string | null;
  contractTerms: string | null;
  signedByA: boolean;
  signedByB: boolean;
  partyAName: string;
  partyBName: string;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md sm:p-6">
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4 text-primary" aria-hidden="true" />
          Case summary
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description ?? "No description provided for this case."}
        </p>
      </div>

      {contractTerms ? (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ScrollText className="h-4 w-4 text-primary" aria-hidden="true" />
            Review and withdrawal conditions
          </h3>
          <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-foreground/90">
            {contractTerms}
          </p>

          {/* Signature status */}
          <div className="flex flex-wrap gap-3 pt-1">
            <SignatureChip label={partyAName} signed={signedByA} party="Client" />
            <SignatureChip label={partyBName} signed={signedByB} party="Operator" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SignatureChip({
  label,
  signed,
  party,
}: {
  label: string;
  signed: boolean;
  party: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
        signed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-white/10 bg-white/5 text-muted-foreground"
      )}
    >
      {signed ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="font-medium text-foreground">{party}</span>
      <span className="text-muted-foreground">·</span>
      <span className="max-w-[10rem] truncate">{label}</span>
      <span className="text-muted-foreground">
        {signed ? "signed" : "unsigned"}
      </span>
    </span>
  );
}

function EscrowOverviewStrip({
  escrow,
  operation,
}: {
  escrow: EscrowContract;
  operation: RecoveryOperationsCase | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md sm:grid-cols-4 sm:p-6">
      <Metric label="Escrow status">
        <EscrowStatusBadge status={escrow.escrow_status} />
      </Metric>
      <Metric label="Escrow account">
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {formatCurrency(escrow.total_amount, escrow.currency)}
        </span>
      </Metric>
      <Metric label="Net withdrawal">
        <span className="text-lg font-semibold tabular-nums text-cyan-300">
          {formatCurrency(escrow.net_release_amount, escrow.currency)}
        </span>
      </Metric>
      <Metric label="Deposit / Withdrawal">
        <span className="text-xs text-muted-foreground">
          {DEPOSIT_STATUS_LABELS[escrow.deposit_status]}
          <span className="px-1">·</span>
          {RELEASE_STATUS_LABELS[escrow.release_status]}
        </span>
      </Metric>
      {operation ? (
        <div className="col-span-2 sm:col-span-4">
          <WithdrawalRequestDialog
            caseId={operation.id}
            availableAmount={escrow.net_release_amount}
            currency={escrow.currency}
            kycStatus={operation.kyc?.status ?? "not_started"}
            releaseStatus={escrow.release_status}
            openConditions={
              operation.withdrawal_conditions.filter(
                (condition) => !condition.satisfied
              ).length
            }
            existingStatus={
              operation.withdrawal_request?.status ?? "not_requested"
            }
            fullWidth
          />
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function TransactionLedger({
  transactions,
  resolveActor,
}: {
  transactions: Awaited<ReturnType<typeof getTransactions>>;
  resolveActor: (id: string | null) => string | undefined;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          No transactions yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Provider-confirmed deposits, fees, and releases will be listed here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md">
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="whitespace-nowrap">Type</TableHead>
              <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Provider Ref</TableHead>
              <TableHead className="whitespace-nowrap">Initiated By</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id} className="border-white/5">
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize text-foreground">
                    <TxnTypeDot type={txn.type} />
                    {txn.type}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                  {formatCurrency(txn.amount, txn.currency)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <TxnStatusBadge status={txn.status} providerStatus={txn.provider_status} />
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {txn.provider_reference ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {resolveActor(txn.initiated_by) ??
                    (txn.initiated_by ? "Participant" : "System")}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(txn.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TxnTypeDot({ type }: { type: string }) {
  const color =
    type === "release"
      ? "bg-emerald-400"
      : type === "deposit"
        ? "bg-blue-400"
        : type === "refund"
          ? "bg-amber-400"
          : "bg-zinc-400";
  return (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color)}
      aria-hidden="true"
    />
  );
}

function TxnStatusBadge({
  status,
  providerStatus,
}: {
  status: "pending" | "confirmed" | "failed";
  providerStatus: string | null;
}) {
  const variant =
    status === "confirmed" ? "success" : status === "failed" ? "destructive" : "warning";
  return (
    <Badge variant={variant} className="capitalize" title={providerStatus ?? undefined}>
      {status}
    </Badge>
  );
}

/** Human readable byte size (kept local to avoid a util dependency). */
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

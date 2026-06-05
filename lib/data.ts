/**
 * Read-side data helpers for Server Components.
 *
 * For this MVP they return rich MOCK data from lib/mock-data.ts so the app is
 * fully viewable in DEMO mode without Supabase configured. Each helper includes
 * a // TODO showing the real Supabase query to swap in.
 *
 * These are SERVER-side helpers — keep them out of client components. Mutations
 * never go through here; use the server actions in lib/actions/*.
 */

import type {
  Profile,
  Case,
  CaseParty,
  EscrowContract,
  EscrowTransaction,
  UploadedFile,
  ChatMessage,
  Approval,
  Dispute,
  AuditLog,
  PlatformStats,
  UserRole,
  FundsBreakdownRow,
  KycReview,
  RecoveredFundsEntry,
  WithdrawalCondition,
  WithdrawalRequest,
  RecoveryReceipt,
  EmailLog,
  RecoveryOperationsCase,
  RecoveryCaseStage,
  KycAuditLog,
  KycDocumentSignedUrls,
  KycStatus,
  KycSubmission,
  KycSubmissionWithProfile,
} from "@/lib/types";
import { DEMO_MODE } from "@/lib/constants";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  MOCK_PROFILES,
  MOCK_CASES,
  MOCK_CASE_PARTIES,
  MOCK_ESCROW_CONTRACTS,
  MOCK_ESCROW_TRANSACTIONS,
  MOCK_UPLOADED_FILES,
  MOCK_CHAT_MESSAGES,
  MOCK_APPROVALS,
  MOCK_DISPUTES,
  MOCK_AUDIT_LOGS,
  MOCK_STATS,
  MOCK_CLIENT,
  MOCK_COUNTERPARTY,
  MOCK_ADMIN,
  MOCK_RECOVERY_CASE_STAGES,
  MOCK_KYC_REVIEWS,
  MOCK_KYC_SUBMISSIONS,
  MOCK_KYC_AUDIT_LOGS,
  MOCK_RECOVERED_FUNDS_ENTRIES,
  MOCK_WITHDRAWAL_CONDITIONS,
  MOCK_WITHDRAWAL_REQUESTS,
  MOCK_RECOVERY_RECEIPTS,
  MOCK_EMAIL_LOGS,
} from "@/lib/mock-data";

function sortByCreatedDesc<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Helper: which case ids a given user participates in (party access). */
function caseIdsForUser(userId: string): string[] {
  return MOCK_CASE_PARTIES.filter(
    (p) => p.profile_id === userId
  ).map((p) => p.case_id);
}

/**
 * Headline platform stats for dashboards / landing.
 *
 * TODO: replace with real aggregates, e.g.
 *   const supabase = await createClient();
 *   const { data: contracts } = await supabase
 *     .from("escrow_contracts")
 *     .select("total_amount, escrow_status");
 *   // sum total_amount for transacted pool; count active; etc.
 *   const { count: resolved } = await supabase
 *     .from("disputes")
 *     .select("id", { count: "exact", head: true })
 *     .in("status", ["resolved_release", "resolved_refund"]);
 */
export async function getStats(): Promise<PlatformStats> {
  return MOCK_STATS;
}

/**
 * Cases visible to a user. Admins see all; clients/counterparties see only the
 * cases they are a party to.
 *
 * TODO: replace with RLS-backed queries, e.g.
 *   const supabase = await createClient();
 *   if (role === "admin") {
 *     const { data } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
 *     return data ?? [];
 *   }
 *   // Non-admin: cases where the user is a party (RLS also enforces this).
 *   const { data } = await supabase
 *     .from("cases")
 *     .select("*, case_parties!inner(profile_id)")
 *     .eq("case_parties.profile_id", userId)
 *     .order("created_at", { ascending: false });
 *   return data ?? [];
 */
export async function getCasesForUser(
  role: UserRole,
  userId?: string
): Promise<Case[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as Case[];
  }

  if (role === "admin") {
    return sortByCreatedDesc(MOCK_CASES);
  }
  const id = userId ?? MOCK_CLIENT.id;
  const ids = new Set(caseIdsForUser(id));
  return sortByCreatedDesc(MOCK_CASES.filter((c) => ids.has(c.id)));
}

/**
 * A single case by id.
 *
 * TODO: replace with:
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("cases").select("*").eq("id", id).single();
 *   return data ?? null;  // RLS ensures the user can only read permitted cases.
 */
export async function getCaseById(id: string): Promise<Case | null> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .maybeSingle<Case>();
    return data ?? null;
  }

  return MOCK_CASES.find((c) => c.id === id) ?? null;
}

/**
 * Case parties for a case (drives per-user access + party labels).
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("case_parties").select("*").eq("case_id", caseId);
 *   return data ?? [];
 */
export async function getCaseParties(caseId: string): Promise<CaseParty[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("case_parties")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    return (data ?? []) as CaseParty[];
  }

  return MOCK_CASE_PARTIES.filter((p) => p.case_id === caseId);
}

/**
 * Uploaded evidence files for a case.
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase
 *     .from("uploaded_files").select("*")
 *     .eq("case_id", caseId).order("created_at", { ascending: false });
 *   return data ?? [];
 */
export async function getFiles(caseId: string): Promise<UploadedFile[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    return (data ?? []) as UploadedFile[];
  }

  return sortByCreatedDesc(MOCK_UPLOADED_FILES.filter((f) => f.case_id === caseId));
}

/**
 * Chat messages for a case (chronological).
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase
 *     .from("chat_messages").select("*")
 *     .eq("case_id", caseId).order("created_at", { ascending: true });
 *   return data ?? [];
 */
export async function getMessages(caseId: string): Promise<ChatMessage[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    return (data ?? []) as ChatMessage[];
  }

  return [...MOCK_CHAT_MESSAGES.filter((m) => m.case_id === caseId)].sort(
    (a, b) => a.created_at.localeCompare(b.created_at)
  );
}

/**
 * Approvals for a case.
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("approvals").select("*").eq("case_id", caseId);
 *   return data ?? [];
 */
export async function getApprovals(caseId: string): Promise<Approval[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("approvals")
      .select("*")
      .eq("case_id", caseId);
    return (data ?? []) as Approval[];
  }

  return MOCK_APPROVALS.filter((a) => a.case_id === caseId);
}

/**
 * Escrow contract for a case (one per case).
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase
 *     .from("escrow_contracts").select("*").eq("case_id", caseId).single();
 *   return data ?? null;
 */
export async function getEscrow(caseId: string): Promise<EscrowContract | null> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("escrow_contracts")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle<EscrowContract>();
    return data ?? null;
  }

  return MOCK_ESCROW_CONTRACTS.find((e) => e.case_id === caseId) ?? null;
}

/**
 * Append-only escrow transaction ledger for a case (most recent first).
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase
 *     .from("escrow_transactions").select("*")
 *     .eq("case_id", caseId).order("created_at", { ascending: false });
 *   return data ?? [];
 */
export async function getTransactions(
  caseId: string
): Promise<EscrowTransaction[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    return (data ?? []) as EscrowTransaction[];
  }

  return sortByCreatedDesc(
    MOCK_ESCROW_TRANSACTIONS.filter((t) => t.case_id === caseId)
  );
}

/**
 * Audit logs. If caseId is provided, scope to that case; otherwise return the
 * platform-wide trail (admin views). Most recent first.
 *
 * TODO:
 *   const supabase = await createClient();
 *   let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
 *   if (caseId) q = q.eq("case_id", caseId);
 *   const { data } = await q;
 *   return data ?? [];
 */
export async function getAuditLogs(caseId?: string): Promise<AuditLog[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);
    const { data } = await query;
    return (data ?? []) as AuditLog[];
  }

  const rows = caseId
    ? MOCK_AUDIT_LOGS.filter((l) => l.case_id === caseId)
    : MOCK_AUDIT_LOGS;
  return sortByCreatedDesc(rows);
}

/**
 * All cases (admin command center).
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase
 *     .from("cases").select("*").order("created_at", { ascending: false });
 *   return data ?? [];  // RLS: admins only.
 */
export async function getAllCasesForAdmin(): Promise<Case[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as Case[];
  }

  return sortByCreatedDesc(MOCK_CASES);
}

/**
 * All disputes (admin disputes view), most recent first.
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data } = await supabase
 *     .from("disputes").select("*").order("created_at", { ascending: false });
 *   return data ?? [];
 */
export async function getDisputes(): Promise<Dispute[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as Dispute[];
  }

  return sortByCreatedDesc(MOCK_DISPUTES);
}

/**
 * A mock "current user" for DEMO rendering, by role. In production the current
 * user comes from supabase.auth.getUser() + the profiles row.
 *
 * TODO:
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   if (!user) return null;
 *   const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
 *   return data ?? null;
 */
export async function getCurrentUserMock(
  role: UserRole = "client"
): Promise<Profile> {
  if (role === "admin") return MOCK_ADMIN;
  if (role === "counterparty") return MOCK_COUNTERPARTY;
  return MOCK_CLIENT;
}

// ── Derived helpers used by composite UI (kept here so the shapes stay in sync)

/** Look up a profile by id (mock). */
export async function getProfileById(id: string): Promise<Profile | null> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle<Profile>();
    return data ?? null;
  }

  return MOCK_PROFILES.find((p) => p.id === id) ?? null;
}

/**
 * Build the rows consumed by FundsBreakdownTable across all visible cases.
 * Joins case + escrow + party display names. Admin sees all; others see theirs.
 *
 * TODO: replace with a single joined Supabase query (cases + escrow_contracts +
 * case_parties + profiles), respecting RLS, then map to FundsBreakdownRow.
 */
export async function getFundsBreakdownRows(
  role: UserRole,
  userId?: string
): Promise<FundsBreakdownRow[]> {
  const cases = await getCasesForUser(role, userId);

  return Promise.all(
    cases.map(async (c) => {
      const [escrow, parties] = DEMO_MODE
        ? [
            MOCK_ESCROW_CONTRACTS.find((e) => e.case_id === c.id) ?? null,
            MOCK_CASE_PARTIES.filter((p) => p.case_id === c.id),
          ]
        : await Promise.all([getEscrow(c.id), getCaseParties(c.id)]);
      const partyA = parties.find((p) => p.party_role === "party_a");
      const partyB = parties.find((p) => p.party_role === "party_b");

      const nameFor = async (party?: CaseParty): Promise<string> => {
        if (!party) return "—";
        if (party.profile_id) {
          const profile = DEMO_MODE
            ? MOCK_PROFILES.find((p) => p.id === party.profile_id) ?? null
            : await getProfileById(party.profile_id);
          if (profile) {
            return profile.full_name ?? profile.company ?? profile.email;
          }
        }
        return party.invited_email ?? "Invited";
      };

      const [partyAName, partyBName] = await Promise.all([
        nameFor(partyA),
        nameFor(partyB),
      ]);

      return {
        caseId: c.id,
        caseNumber: c.case_number,
        client: partyAName,
        counterparty: partyBName,
        total: escrow?.total_amount ?? 0,
        platformFee: escrow?.platform_fee ?? 0,
        providerFee: escrow?.provider_fee ?? 0,
        netRelease: escrow?.net_release_amount ?? 0,
        currency: escrow?.currency ?? "USD",
        depositStatus: escrow?.deposit_status ?? "awaiting",
        escrowStatus: escrow?.escrow_status ?? "pending_deposit",
        releaseStatus: escrow?.release_status ?? "not_started",
        lastUpdated: escrow?.updated_at ?? c.updated_at,
      };
    })
  );
}

export async function getKycReview(
  caseId: string
): Promise<KycReview | null> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recovery_kyc_reviews")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle<KycReview>();
    return error ? null : data ?? null;
  }

  return MOCK_KYC_REVIEWS.find((k) => k.case_id === caseId) ?? null;
}

async function attachProfilesToKycSubmissions(
  submissions: KycSubmission[]
): Promise<KycSubmissionWithProfile[]> {
  if (submissions.length === 0) return [];

  if (DEMO_MODE) {
    return submissions.map((submission) => ({
      ...submission,
      profile: MOCK_PROFILES.find((p) => p.id === submission.user_id) ?? null,
    }));
  }

  const admin = createAdminClient();
  const userIds = Array.from(new Set(submissions.map((item) => item.user_id)));
  const { data: profiles } = await admin
    .from("profiles")
    .select("*")
    .in("id", userIds);
  const profileMap = new Map(
    ((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile])
  );

  return submissions.map((submission) => ({
    ...submission,
    profile: profileMap.get(submission.user_id) ?? null,
  }));
}

export async function getLatestKycSubmissionForUser(
  userId: string
): Promise<KycSubmissionWithProfile | null> {
  if (DEMO_MODE) {
    const submission =
      [...MOCK_KYC_SUBMISSIONS]
        .filter((item) => item.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    if (!submission) return null;
    return {
      ...submission,
      profile: MOCK_PROFILES.find((p) => p.id === submission.user_id) ?? null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kyc_submissions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<KycSubmission>();

  if (error || !data) return null;
  const [withProfile] = await attachProfilesToKycSubmissions([data]);
  return withProfile ?? null;
}

export async function getKycSubmissionsForAdmin({
  status,
  search,
}: {
  status?: KycStatus | "all";
  search?: string;
} = {}): Promise<KycSubmissionWithProfile[]> {
  if (DEMO_MODE) {
    const withProfiles = await attachProfilesToKycSubmissions(
      [...MOCK_KYC_SUBMISSIONS].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      )
    );
    return filterKycSubmissions(withProfiles, status, search);
  }

  const admin = createAdminClient();
  let query = admin
    .from("kyc_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return [];

  const withProfiles = await attachProfilesToKycSubmissions(
    (data ?? []) as KycSubmission[]
  );
  return filterKycSubmissions(withProfiles, status, search);
}

function filterKycSubmissions(
  submissions: KycSubmissionWithProfile[],
  status?: KycStatus | "all",
  search?: string
): KycSubmissionWithProfile[] {
  const needle = search?.trim().toLowerCase();
  return submissions.filter((submission) => {
    if (status && status !== "all" && submission.status !== status) return false;
    if (!needle) return true;
    const profile = submission.profile;
    return [
      submission.id,
      submission.full_legal_name,
      submission.email,
      submission.phone,
      submission.id_number,
      profile?.full_name,
      profile?.email,
      profile?.phone,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
}

export async function getKycSubmissionById(
  submissionId: string
): Promise<KycSubmissionWithProfile | null> {
  if (DEMO_MODE) {
    const submission =
      MOCK_KYC_SUBMISSIONS.find((item) => item.id === submissionId) ?? null;
    if (!submission) return null;
    const [withProfile] = await attachProfilesToKycSubmissions([submission]);
    return withProfile ?? null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("kyc_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle<KycSubmission>();

  if (error || !data) return null;
  const [withProfile] = await attachProfilesToKycSubmissions([data]);
  return withProfile ?? null;
}

export async function getKycAuditLogsForSubmission(
  submissionId: string
): Promise<KycAuditLog[]> {
  if (DEMO_MODE) {
    return MOCK_KYC_AUDIT_LOGS.filter(
      (item) => item.submission_id === submissionId
    ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("kyc_audit_logs")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });

  return error ? [] : ((data ?? []) as KycAuditLog[]);
}

async function signedKycUrl(path: string | null): Promise<string | null> {
  if (!path || DEMO_MODE) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("kyc-documents")
    .createSignedUrl(path, 60 * 10);
  return error ? null : data.signedUrl;
}

export async function getSignedKycDocumentUrls(
  submission: Pick<
    KycSubmission,
    "id_front_url" | "id_back_url" | "selfie_url" | "proof_of_address_url"
  >
): Promise<KycDocumentSignedUrls> {
  const [idFront, idBack, selfie, proof] = await Promise.all([
    signedKycUrl(submission.id_front_url),
    signedKycUrl(submission.id_back_url),
    signedKycUrl(submission.selfie_url),
    signedKycUrl(submission.proof_of_address_url),
  ]);

  return {
    id_front_url: idFront,
    id_back_url: idBack,
    selfie_url: selfie,
    proof_of_address_url: proof,
  };
}

export async function getRecoveredFundsEntries(
  caseId: string
): Promise<RecoveredFundsEntry[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recovered_funds_entries")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    return error ? [] : ((data ?? []) as RecoveredFundsEntry[]);
  }

  return MOCK_RECOVERED_FUNDS_ENTRIES.filter((entry) => entry.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getWithdrawalConditions(
  caseId: string
): Promise<WithdrawalCondition[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("withdrawal_conditions")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    return error ? [] : ((data ?? []) as WithdrawalCondition[]);
  }

  return MOCK_WITHDRAWAL_CONDITIONS.filter((c) => c.case_id === caseId).sort(
    (a, b) => b.created_at.localeCompare(a.created_at)
  );
}

export async function getWithdrawalRequest(
  caseId: string
): Promise<WithdrawalRequest | null> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("case_id", caseId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle<WithdrawalRequest>();
    return error ? null : data ?? null;
  }

  return MOCK_WITHDRAWAL_REQUESTS.find((w) => w.case_id === caseId) ?? null;
}

export async function getRecoveryReceipts(
  caseId?: string
): Promise<RecoveryReceipt[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    let query = supabase
      .from("recovery_receipts")
      .select("*")
      .order("issued_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);
    const { data, error } = await query;
    return error ? [] : ((data ?? []) as RecoveryReceipt[]);
  }

  const rows = caseId
    ? MOCK_RECOVERY_RECEIPTS.filter((r) => r.case_id === caseId)
    : MOCK_RECOVERY_RECEIPTS;
  return [...rows].sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}

export async function getReceiptById(
  receiptId: string
): Promise<RecoveryReceipt | null> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recovery_receipts")
      .select("*")
      .eq("id", receiptId)
      .maybeSingle<RecoveryReceipt>();
    return error ? null : data ?? null;
  }

  return MOCK_RECOVERY_RECEIPTS.find((r) => r.id === receiptId) ?? null;
}

export async function getEmailLogs(caseId?: string): Promise<EmailLog[]> {
  if (!DEMO_MODE) {
    const supabase = await createClient();
    let query = supabase
      .from("email_logs")
      .select("*")
      .order("created_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);
    const { data, error } = await query;
    return error ? [] : ((data ?? []) as EmailLog[]);
  }

  const rows = caseId
    ? MOCK_EMAIL_LOGS.filter((e) => e.case_id === caseId)
    : MOCK_EMAIL_LOGS;
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function recoveryStageForCase(caseId: string): RecoveryCaseStage {
  return MOCK_RECOVERY_CASE_STAGES[caseId] ?? "complaint_submitted";
}

function deriveRecoveryStage(
  caseRow: Case,
  escrow: EscrowContract | null,
  recoveredFunds: RecoveredFundsEntry[],
  withdrawalRequest: WithdrawalRequest | null
): RecoveryCaseStage {
  if (withdrawalRequest?.status === "paid_out" || escrow?.escrow_status === "released") {
    return "paid_out";
  }
  if (
    withdrawalRequest?.status === "requested" ||
    withdrawalRequest?.status === "approved" ||
    withdrawalRequest?.status === "conditions_required"
  ) {
    return "withdrawal_review";
  }
  if (escrow?.deposit_status === "received") {
    return "escrow_funded";
  }
  if (recoveredFunds.length > 0) {
    return "funds_recovered";
  }
  if (caseRow.status === "suspended") {
    return "more_evidence_needed";
  }
  if (caseRow.status === "closed") {
    return "accepted";
  }
  if (caseRow.status === "under_dispute" || caseRow.status === "active") {
    return "admin_review";
  }
  return "complaint_submitted";
}

async function composeRecoveryOperationsCase(
  caseRow: Case
): Promise<RecoveryOperationsCase> {
  const [
    parties,
    escrow,
    kyc,
    recoveredFunds,
    withdrawalConditions,
    withdrawalRequest,
    receipts,
    emailLogs,
  ] = DEMO_MODE
    ? [
        MOCK_CASE_PARTIES.filter((p) => p.case_id === caseRow.id),
        MOCK_ESCROW_CONTRACTS.find((e) => e.case_id === caseRow.id) ?? null,
        MOCK_KYC_REVIEWS.find((k) => k.case_id === caseRow.id) ?? null,
        MOCK_RECOVERED_FUNDS_ENTRIES.filter(
          (entry) => entry.case_id === caseRow.id
        ).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        MOCK_WITHDRAWAL_CONDITIONS.filter(
          (condition) => condition.case_id === caseRow.id
        ).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        MOCK_WITHDRAWAL_REQUESTS.find((w) => w.case_id === caseRow.id) ?? null,
        MOCK_RECOVERY_RECEIPTS.filter((r) => r.case_id === caseRow.id).sort(
          (a, b) => b.issued_at.localeCompare(a.issued_at)
        ),
        MOCK_EMAIL_LOGS.filter((e) => e.case_id === caseRow.id).sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        ),
      ]
    : await Promise.all([
        getCaseParties(caseRow.id),
        getEscrow(caseRow.id),
        getKycReview(caseRow.id),
        getRecoveredFundsEntries(caseRow.id),
        getWithdrawalConditions(caseRow.id),
        getWithdrawalRequest(caseRow.id),
        getRecoveryReceipts(caseRow.id),
        getEmailLogs(caseRow.id),
      ]);
  const recoveredAmount = recoveredFunds
    .filter((entry) => entry.visible_to_client)
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const escrowAvailableAmount =
    withdrawalRequest?.status === "paid_out" ? 0 : recoveredAmount;

  return {
    ...caseRow,
    parties,
    escrow,
    recovery_stage: DEMO_MODE
      ? recoveryStageForCase(caseRow.id)
      : deriveRecoveryStage(caseRow, escrow, recoveredFunds, withdrawalRequest),
    kyc,
    recovered_funds: recoveredFunds,
    withdrawal_conditions: withdrawalConditions,
    withdrawal_request: withdrawalRequest,
    receipts,
    email_logs: emailLogs,
    recovered_amount: recoveredAmount,
    escrow_available_amount: escrowAvailableAmount,
  };
}

export async function getRecoveryOperationsCases(
  role: UserRole = "admin",
  userId?: string
): Promise<RecoveryOperationsCase[]> {
  const cases = await getCasesForUser(role, userId);
  return Promise.all(cases.map(composeRecoveryOperationsCase));
}

export async function getRecoveryCaseOperations(
  caseId: string
): Promise<RecoveryOperationsCase | null> {
  const caseRow = await getCaseById(caseId);
  return caseRow ? composeRecoveryOperationsCase(caseRow) : null;
}

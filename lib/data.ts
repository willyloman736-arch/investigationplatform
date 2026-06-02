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
} from "@/lib/types";
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
} from "@/lib/mock-data";

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
  if (role === "admin") {
    return [...MOCK_CASES].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }
  const id = userId ?? MOCK_CLIENT.id;
  const ids = new Set(caseIdsForUser(id));
  return MOCK_CASES.filter((c) => ids.has(c.id)).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
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
  return MOCK_UPLOADED_FILES.filter((f) => f.case_id === caseId).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
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
  return MOCK_CHAT_MESSAGES.filter((m) => m.case_id === caseId).sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
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
  return MOCK_ESCROW_TRANSACTIONS.filter((t) => t.case_id === caseId).sort(
    (a, b) => b.created_at.localeCompare(a.created_at)
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
  const rows = caseId
    ? MOCK_AUDIT_LOGS.filter((l) => l.case_id === caseId)
    : MOCK_AUDIT_LOGS;
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  return [...MOCK_CASES].sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  return [...MOCK_DISPUTES].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
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

  return cases.map((c) => {
    const escrow = MOCK_ESCROW_CONTRACTS.find((e) => e.case_id === c.id);
    const parties = MOCK_CASE_PARTIES.filter((p) => p.case_id === c.id);
    const partyA = parties.find((p) => p.party_role === "party_a");
    const partyB = parties.find((p) => p.party_role === "party_b");

    const nameFor = (party?: CaseParty): string => {
      if (!party) return "—";
      if (party.profile_id) {
        const profile = MOCK_PROFILES.find((p) => p.id === party.profile_id);
        if (profile) {
          return profile.full_name ?? profile.company ?? profile.email;
        }
      }
      return party.invited_email ?? "Invited";
    };

    return {
      caseId: c.id,
      caseNumber: c.case_number,
      client: nameFor(partyA),
      counterparty: nameFor(partyB),
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
  });
}

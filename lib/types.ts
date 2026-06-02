/**
 * AEGIS shared TypeScript types.
 * String-literal unions mirror the Postgres ENUMs exactly; row types mirror the
 * table columns (snake_case) from the SPEC data model. Import these everywhere
 * instead of redefining shapes.
 */

// ── Enum unions (match Postgres ENUMs) ───────────────────────────────────────
export type UserRole = "client" | "counterparty" | "admin";

export type CaseStatus =
  | "draft"
  | "active"
  | "suspended"
  | "closed"
  | "under_dispute";

export type PartyRole = "party_a" | "party_b" | "observer";

export type EscrowStatus =
  | "pending_deposit"
  | "securely_escrowed"
  | "under_dispute_audit"
  | "ready_for_release"
  | "release_frozen"
  | "released";

export type DepositStatus = "awaiting" | "received" | "failed";

export type ReleaseStatus =
  | "not_started"
  | "eligible"
  | "requested"
  | "completed";

export type TxnType = "deposit" | "release" | "fee" | "refund";

export type TxnStatus = "pending" | "confirmed" | "failed";

export type FileCategory =
  | "csv"
  | "pdf_receipt"
  | "image_receipt"
  | "chat_log"
  | "text"
  | "tx_hash"
  | "other";

export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_release"
  | "resolved_refund"
  | "rejected";

// ── Row types (match table columns) ──────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  company: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string | null;
  category: string | null;
  status: CaseStatus;
  created_by: string;
  assigned_admin: string | null;
  contract_terms: string | null;
  contract_signed_by_a: boolean;
  contract_signed_by_b: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseParty {
  id: string;
  case_id: string;
  profile_id: string | null;
  invited_email: string | null;
  party_role: PartyRole;
  accepted: boolean;
  created_at: string;
}

export interface EscrowContract {
  id: string;
  case_id: string;
  currency: string;
  total_amount: number;
  platform_fee: number;
  provider_fee: number;
  net_release_amount: number;
  escrow_status: EscrowStatus;
  deposit_status: DepositStatus;
  release_status: ReleaseStatus;
  provider_reference: string | null;
  release_eligibility_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowTransaction {
  id: string;
  escrow_contract_id: string;
  case_id: string;
  type: TxnType;
  amount: number;
  currency: string;
  provider_reference: string | null;
  provider_status: string | null;
  status: TxnStatus;
  initiated_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface UploadedFile {
  id: string;
  case_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: FileCategory;
  storage_path: string;
  file_url: string | null;
  size_bytes: number;
  notes: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  case_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Approval {
  id: string;
  case_id: string;
  escrow_contract_id: string;
  party_role: PartyRole;
  approved_by: string | null;
  approved: boolean;
  note: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  case_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  case_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  reason: string | null;
  created_at: string;
}

// ── Convenience composite/view types used by the UI ─────────────────────────
export interface CaseWithRelations extends Case {
  parties?: CaseParty[];
  escrow?: EscrowContract | null;
  created_by_profile?: Profile | null;
  assigned_admin_profile?: Profile | null;
}

/** Shape consumed by FundsBreakdownTable rows. */
export interface FundsBreakdownRow {
  caseId: string;
  caseNumber: string;
  client: string;
  counterparty: string;
  total: number;
  platformFee: number;
  providerFee: number;
  netRelease: number;
  currency: string;
  depositStatus: DepositStatus;
  escrowStatus: EscrowStatus;
  releaseStatus: ReleaseStatus;
  lastUpdated: string;
}

/** Headline stats for dashboards / landing. */
export interface PlatformStats {
  totalTransactedPool: number;
  activeDisputesResolved: number;
  activeEscrowContracts: number;
  currency: string;
}

/** Minimal user descriptor passed into the dashboard shell. */
export interface SessionUser {
  name: string;
  email: string;
  role: UserRole;
}

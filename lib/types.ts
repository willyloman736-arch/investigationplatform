/**
 * Digital Asset Investigations shared TypeScript types.
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

export type RecoveryCaseStage =
  | "complaint_submitted"
  | "admin_review"
  | "accepted"
  | "rejected"
  | "more_evidence_needed"
  | "recovery_in_progress"
  | "funds_recovered"
  | "escrow_funded"
  | "withdrawal_review"
  | "paid_out";

export type KycStatus =
  | "not_started"
  | "in_review"
  | "verified"
  | "rejected";

export type KycDocumentStatus =
  | "not_submitted"
  | "submitted"
  | "verified"
  | "rejected";

export type PayoutMethod =
  | "bank_transfer"
  | "card"
  | "paypal";

export type WithdrawalStatus =
  | "not_requested"
  | "conditions_required"
  | "requested"
  | "approved"
  | "denied"
  | "paid_out";

export type WithdrawalConditionGate =
  | "before_request"
  | "before_approval"
  | "before_payout";

export type RecoveryReceiptKind =
  | "case_update"
  | "recovered_funds"
  | "withdrawal_condition"
  | "withdrawal_approval"
  | "withdrawal_paid";

export type EmailDeliveryStatus =
  | "queued"
  | "sent_placeholder"
  | "failed";

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

export interface KycReview {
  id: string;
  case_id: string;
  profile_id: string;
  status: KycStatus;
  government_id_status: KycDocumentStatus;
  selfie_status: KycDocumentStatus;
  proof_of_address_status: KycDocumentStatus;
  phone_verified: boolean;
  email_verified: boolean;
  reviewer_id: string | null;
  review_note: string | null;
  updated_at: string;
}

export interface RecoveredFundsEntry {
  id: string;
  case_id: string;
  amount: number;
  currency: string;
  source_label: string;
  provider_reference: string | null;
  visible_to_client: boolean;
  entered_by: string;
  notes: string | null;
  created_at: string;
}

export interface WithdrawalCondition {
  id: string;
  case_id: string;
  label: string;
  description: string;
  gate: WithdrawalConditionGate;
  satisfied: boolean;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
}

export interface WithdrawalRequest {
  id: string;
  case_id: string;
  profile_id: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  destination_label: string;
  status: WithdrawalStatus;
  admin_note: string | null;
  requested_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface RecoveryReceipt {
  id: string;
  case_id: string;
  receipt_number: string;
  kind: RecoveryReceiptKind;
  title: string;
  amount: number | null;
  currency: string;
  recipient_email: string;
  issued_by: string;
  issued_at: string;
  notes: string | null;
}

export interface EmailLog {
  id: string;
  case_id: string;
  recipient_email: string;
  subject: string;
  status: EmailDeliveryStatus;
  provider_reference: string | null;
  related_receipt_id: string | null;
  created_at: string;
  sent_at: string | null;
}

// ── Convenience composite/view types used by the UI ─────────────────────────
export interface CaseWithRelations extends Case {
  parties?: CaseParty[];
  escrow?: EscrowContract | null;
  created_by_profile?: Profile | null;
  assigned_admin_profile?: Profile | null;
}

export interface RecoveryOperationsCase extends CaseWithRelations {
  recovery_stage: RecoveryCaseStage;
  kyc: KycReview | null;
  recovered_funds: RecoveredFundsEntry[];
  withdrawal_conditions: WithdrawalCondition[];
  withdrawal_request: WithdrawalRequest | null;
  receipts: RecoveryReceipt[];
  email_logs: EmailLog[];
  recovered_amount: number;
  escrow_available_amount: number;
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

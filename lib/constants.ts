import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  ShieldAlert,
  Gauge,
  CreditCard,
  ScrollText,
  UserRound,
  IdCard,
  type LucideIcon,
} from "lucide-react";
import type {
  EscrowStatus,
  CaseStatus,
  DepositStatus,
  ReleaseStatus,
  FileCategory,
  RecoveryCaseStage,
  KycStatus,
  KycDocumentStatus,
  WithdrawalStatus,
  PayoutMethod,
  WithdrawalConditionGate,
  KycIdType,
  KycProofType,
} from "@/lib/types";

/**
 * Brand name. To rebrand, update these and replace the SVG artwork in
 * /public/brand (and app/icon.svg) used by components/shared/Logo.tsx.
 */
export const APP_NAME = "Digital Asset Investigations";
export const APP_SHORT_NAME = "DAI";

export const APP_TAGLINE = "Crypto Scam Recovery & Secure Escrow";

/**
 * Honest, reusable disclaimer. Never claim encryption/certifications we do not
 * actually implement.
 */
export const PROVIDER_DISCLAIMER =
  "Funds are processed only through licensed payment/escrow partners where available.";

/**
 * Demo mode flag. ON when explicitly enabled (NEXT_PUBLIC_DEMO_MODE="true") OR
 * automatically whenever no Supabase project is configured — so a fresh deploy
 * is a working showcase on mock data instead of a broken login. As soon as a
 * real NEXT_PUBLIC_SUPABASE_URL is set, demo mode turns off (unless explicitly
 * forced on). It never exposes real data: it only auto-enables when there is no
 * database to connect to.
 */
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── Fee rates (used for display + mock math only; no real balance arithmetic) ─
export const PLATFORM_FEE_RATE = 0.03; // 3%
export const PROVIDER_FEE_RATE = 0.015; // 1.5%

// ── Upload constraints ──────────────────────────────────────────────────────
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
export const MAX_KYC_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Accepted file types per evidence category, keyed by FileCategory.
 * Values are react-dropzone `accept` maps (mime -> extensions). The combined
 * map (ACCEPTED_FILE_TYPES_COMBINED) is convenient for a single dropzone.
 */
export const ACCEPTED_FILE_TYPES: Record<
  FileCategory,
  Record<string, string[]>
> = {
  csv: {
    "text/csv": [".csv"],
    "application/vnd.ms-excel": [".csv"],
  },
  pdf_receipt: {
    "application/pdf": [".pdf"],
  },
  image_receipt: {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/heic": [".heic"],
  },
  chat_log: {
    "text/plain": [".txt", ".log"],
    "application/json": [".json"],
    "text/csv": [".csv"],
  },
  text: {
    "text/plain": [".txt", ".md"],
  },
  tx_hash: {
    // Blockchain transaction hash submitted as a small text/note file.
    "text/plain": [".txt"],
  },
  other: {
    "application/pdf": [".pdf"],
    "text/plain": [".txt"],
    "text/csv": [".csv"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "application/json": [".json"],
    "application/zip": [".zip"],
  },
};

/** Single combined accept map covering every supported evidence type. */
export const ACCEPTED_FILE_TYPES_COMBINED: Record<string, string[]> = {
  "text/csv": [".csv"],
  "application/vnd.ms-excel": [".csv"],
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "text/plain": [".txt", ".log", ".md"],
  "application/json": [".json"],
  "application/zip": [".zip"],
};

export const ACCEPTED_KYC_FILE_TYPES: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "application/pdf": [".pdf"],
};

/** Human-readable labels for file categories (used in selects/badges). */
export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  csv: "CSV / Spreadsheet",
  pdf_receipt: "PDF Receipt",
  image_receipt: "Image Receipt",
  chat_log: "Chat Log",
  text: "Text Note",
  tx_hash: "Blockchain Tx Hash",
  other: "Other",
};

// ── Escrow status badge configuration ───────────────────────────────────────
export interface StatusConfig {
  label: string;
  /** Tailwind classes for the badge container (bg + text + border). */
  badgeClass: string;
  /** Tailwind classes for the small colored status dot. */
  dotClass: string;
  description: string;
}

export const ESCROW_STATUS_CONFIG: Record<EscrowStatus, StatusConfig> = {
  pending_deposit: {
    label: "PENDING DEPOSIT",
    badgeClass:
      "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    dotClass: "bg-amber-400",
    description:
      "Awaiting the funding deposit to be confirmed by the licensed escrow partner.",
  },
  securely_escrowed: {
    label: "SECURELY ESCROWED",
    badgeClass:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    dotClass: "bg-emerald-400",
    description:
      "Funds are confirmed held by the escrow partner and locked pending approvals.",
  },
  under_dispute_audit: {
    label: "UNDER DISPUTE AUDIT",
    badgeClass: "bg-red-500/10 text-red-400 border border-red-500/30",
    dotClass: "bg-red-400",
    description:
      "A dispute is open. Release is paused while evidence is reviewed.",
  },
  ready_for_release: {
    label: "READY FOR RELEASE",
    badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    dotClass: "bg-blue-400",
    description:
      "The escrow has been cleared for release after approval or documented resolution.",
  },
  release_approved: {
    label: "RELEASE APPROVED",
    badgeClass:
      "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
    dotClass: "bg-emerald-300",
    description:
      "Release eligibility has been approved and is ready for provider payout review.",
  },
  release_frozen: {
    label: "RELEASE FROZEN",
    badgeClass:
      "bg-orange-500/10 text-orange-400 border border-orange-500/30",
    dotClass: "bg-orange-400",
    description:
      "Release is paused pending additional verification. No funds can move.",
  },
  released: {
    label: "RELEASED",
    badgeClass:
      "bg-slate-500/10 text-emerald-300 border border-emerald-500/20",
    dotClass: "bg-emerald-300",
    description:
      "The escrow partner has confirmed the release. The case can be closed.",
  },
};

// ── Case status configuration ───────────────────────────────────────────────
export const CASE_STATUS_CONFIG: Record<CaseStatus, StatusConfig> = {
  draft: {
    label: "DRAFT",
    badgeClass:
      "bg-zinc-500/10 text-zinc-300 border border-zinc-500/30",
    dotClass: "bg-zinc-400",
    description: "Case is being prepared and is not yet active.",
  },
  active: {
    label: "ACTIVE",
    badgeClass:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    dotClass: "bg-emerald-400",
    description: "Case is active and in progress.",
  },
  suspended: {
    label: "SUSPENDED",
    badgeClass:
      "bg-orange-500/10 text-orange-400 border border-orange-500/30",
    dotClass: "bg-orange-400",
    description: "Case is temporarily paused for review.",
  },
  closed: {
    label: "CLOSED",
    badgeClass:
      "bg-slate-500/10 text-slate-300 border border-slate-500/30",
    dotClass: "bg-slate-400",
    description: "Case is closed and archived.",
  },
  under_dispute: {
    label: "UNDER DISPUTE",
    badgeClass: "bg-red-500/10 text-red-400 border border-red-500/30",
    dotClass: "bg-red-400",
    description: "Case has an open dispute under formal review.",
  },
};

// ── Deposit / release status labels ─────────────────────────────────────────
export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  awaiting: "Awaiting Deposit",
  received: "Deposit Received",
  failed: "Deposit Failed",
};

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  not_started: "Not Started",
  eligible: "Eligible",
  requested: "Release Requested",
  completed: "Completed",
};

export const RECOVERY_STAGE_LABELS: Record<RecoveryCaseStage, string> = {
  complaint_submitted: "Complaint Submitted",
  admin_review: "Case Review",
  accepted: "Accepted",
  rejected: "Rejected",
  more_evidence_needed: "More Evidence Needed",
  recovery_in_progress: "Recovery In Progress",
  funds_recovered: "Funds Recovered",
  escrow_funded: "Escrow Funded",
  withdrawal_review: "Withdrawal Review",
  paid_out: "Paid Out",
};

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  not_started: "Not Started",
  in_review: "In Review",
  pending_review: "Pending Review",
  verified: "Verified",
  rejected: "Rejected",
  declined: "Declined",
  resubmission_required: "Resubmission Required",
};

export const KYC_STATUS_BADGE_VARIANTS: Record<
  KycStatus,
  "secondary" | "warning" | "success" | "destructive" | "info"
> = {
  not_started: "secondary",
  in_review: "warning",
  pending_review: "warning",
  verified: "success",
  rejected: "destructive",
  declined: "destructive",
  resubmission_required: "info",
};

export const KYC_ID_TYPE_LABELS: Record<KycIdType, string> = {
  passport: "Passport",
  drivers_license: "Driver's License",
  national_id: "National ID",
};

export const KYC_PROOF_TYPE_LABELS: Record<KycProofType, string> = {
  utility_bill: "Utility Bill",
  bank_statement: "Bank Statement",
  lease_agreement: "Lease Agreement",
  tax_document: "Tax Document",
};

export const KYC_DOCUMENT_STATUS_LABELS: Record<KycDocumentStatus, string> = {
  not_submitted: "Not Submitted",
  submitted: "Submitted",
  verified: "Verified",
  rejected: "Rejected",
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  not_requested: "Not Requested",
  draft: "Draft",
  submitted: "Submitted",
  pending_admin_review: "Pending Review",
  conditions_required: "Conditions Required",
  requested: "Requested",
  approved_for_processing: "Approved for Processing",
  processing: "Processing",
  approved: "Approved",
  paid: "Paid",
  failed: "Failed",
  rejected: "Rejected",
  denied: "Denied",
  paid_out: "Paid Out",
  cancelled: "Cancelled",
};

export const WITHDRAWAL_STATUS_BADGE_VARIANTS: Record<
  WithdrawalStatus,
  "secondary" | "warning" | "success" | "destructive" | "info"
> = {
  not_requested: "secondary",
  draft: "secondary",
  submitted: "info",
  pending_admin_review: "warning",
  conditions_required: "warning",
  requested: "info",
  approved_for_processing: "success",
  processing: "info",
  approved: "success",
  paid: "success",
  failed: "destructive",
  rejected: "destructive",
  denied: "destructive",
  paid_out: "success",
  cancelled: "secondary",
};

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  bank_transfer: "Bank Transfer",
  card: "Visa/Mastercard",
  paypal: "PayPal",
};

export const SUPPORTED_PAYOUT_METHODS: Array<{
  method: PayoutMethod;
  label: string;
  description: string;
}> = [
  {
    method: "bank_transfer",
    label: "Bank Transfer",
    description: "Authorized bank payout after escrow review.",
  },
  {
    method: "card",
    label: "Visa/Mastercard",
    description: "Card payout rail for eligible Visa or Mastercard accounts.",
  },
  {
    method: "paypal",
    label: "PayPal",
    description: "PayPal payout when release conditions are satisfied.",
  },
];

export const SUPPORTED_PAYOUT_METHODS_LABEL =
  "Bank Transfer | Visa/Mastercard | PayPal";

export const CARD_PAYOUT_BRANDS_LABEL =
  "Visa, Mastercard, American Express";

export const WITHDRAWAL_CONDITION_GATE_LABELS: Record<
  WithdrawalConditionGate,
  string
> = {
  before_request: "Before Request",
  before_approval: "Before Approval",
  before_payout: "Before Payout",
};

// ── Navigation ──────────────────────────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_CLIENT: NavItem[] = [
  { label: "Escrow Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Recovery Cases", href: "/dashboard/cases", icon: FolderKanban },
  { label: "KYC Verification", href: "/dashboard/kyc", icon: IdCard },
  { label: "Profile & Settings", href: "/dashboard/profile", icon: UserRound },
];

export const NAV_ADMIN: NavItem[] = [
  { label: "Command Center", href: "/admin", icon: Gauge },
  { label: "Recovery Cases", href: "/admin/cases", icon: FolderKanban },
  { label: "KYC Queue", href: "/admin/kyc", icon: IdCard },
  { label: "Withdrawals", href: "/admin/withdrawals", icon: CreditCard },
  { label: "Disputes", href: "/admin/disputes", icon: ShieldAlert },
];

/** Secondary in-case tab references (kept here so labels stay consistent). */
export const CASE_TABS = {
  intake: { label: "Complaint / Recovery Case", icon: ScrollText },
  ledger: { label: "Escrow Account", icon: Wallet },
} as const;

// ── Currency default ────────────────────────────────────────────────────────
export const DEFAULT_CURRENCY = "USD";

import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  ShieldAlert,
  Gauge,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import type {
  EscrowStatus,
  CaseStatus,
  DepositStatus,
  ReleaseStatus,
  FileCategory,
} from "@/lib/types";

/**
 * Brand name placeholder. AEGIS is changeable — update here and in
 * components/shared/Logo.tsx to rebrand the entire app.
 */
export const APP_NAME = "AEGIS";

export const APP_TAGLINE = "Secure Escrow & Investigation Management";

/**
 * Honest, reusable disclaimer. Never claim encryption/certifications we do not
 * actually implement.
 */
export const PROVIDER_DISCLAIMER =
  "Funds are processed only through licensed payment/escrow partners where available.";

/**
 * Demo mode flag. When true, the auth guard is bypassed and pages render from
 * mock data so the app is viewable without Supabase configured.
 * MUST be false (or unset) in production.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// ── Fee rates (used for display + mock math only; no real balance arithmetic) ─
export const PLATFORM_FEE_RATE = 0.03; // 3%
export const PROVIDER_FEE_RATE = 0.015; // 1.5%

// ── Upload constraints ──────────────────────────────────────────────────────
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

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
      "A dispute is open. Release is blocked while an admin reviews evidence.",
  },
  ready_for_release: {
    label: "READY FOR RELEASE",
    badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    dotClass: "bg-blue-400",
    description:
      "Both parties approved (or a dispute resolved to release). Eligible to request release.",
  },
  release_frozen: {
    label: "RELEASE FROZEN",
    badgeClass:
      "bg-orange-500/10 text-orange-400 border border-orange-500/30",
    dotClass: "bg-orange-400",
    description:
      "An admin has frozen release pending additional verification. No funds can move.",
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
    description: "Case is temporarily suspended by an admin.",
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
    description: "Case has an open dispute under admin review.",
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

// ── Navigation ──────────────────────────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_CLIENT: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cases", href: "/dashboard/cases", icon: FolderKanban },
];

export const NAV_ADMIN: NavItem[] = [
  { label: "Command Center", href: "/admin", icon: Gauge },
  { label: "Cases", href: "/admin/cases", icon: FolderKanban },
  { label: "Disputes", href: "/admin/disputes", icon: ShieldAlert },
];

/** Secondary in-case tab references (kept here so labels stay consistent). */
export const CASE_TABS = {
  intake: { label: "Intake & Case Management", icon: ScrollText },
  ledger: { label: "Escrow Ledger", icon: Wallet },
} as const;

// ── Currency default ────────────────────────────────────────────────────────
export const DEFAULT_CURRENCY = "USD";

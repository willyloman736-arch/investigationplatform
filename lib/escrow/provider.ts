// NEVER import in a client component.
// ─────────────────────────────────────────────────────────────────────────────
// MOCK escrow/payment provider abstraction.
//
// This module is the ONLY boundary through which "money movement" is ever
// represented in AEGIS. It does NOT move real funds and performs NO balance
// arithmetic. Every method returns realistic, provider-confirmed *status* data.
//
// To go live, replace each mocked method with a real call to a LICENSED
// payment/escrow provider (look for `// TODO(provider):` markers). Keys are read
// from process.env and are SERVER-ONLY:
//   - ESCROW_PROVIDER_API_KEY
//   - ESCROW_PROVIDER_WEBHOOK_SECRET
//
// Honest copy rule: we never claim escrow/encryption we do not implement. This
// is a mock until a provider is wired in.
// ─────────────────────────────────────────────────────────────────────────────

import type { EscrowContract } from "@/lib/types";

const PROVIDER_API_KEY = process.env.ESCROW_PROVIDER_API_KEY;
const PROVIDER_WEBHOOK_SECRET = process.env.ESCROW_PROVIDER_WEBHOOK_SECRET;

// ── Input/output shapes ──────────────────────────────────────────────────────
export interface CreateEscrowAccountInput {
  caseId: string;
  currency: string;
  totalAmount: number;
  platformFee: number;
  providerFee: number;
  netReleaseAmount: number;
  reference?: string;
}

export interface CreateEscrowAccountResult {
  providerReference: string;
  status: "created";
  depositInstructionsUrl: string | null;
}

export interface DepositStatusResult {
  providerReference: string;
  depositStatus: "awaiting" | "received" | "failed";
  confirmedAmount: number | null;
  currency: string | null;
}

export interface WebhookDepositPayload {
  type: string;
  providerReference: string;
  amount?: number;
  currency?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ConfirmDepositResult {
  providerReference: string;
  depositStatus: "received" | "failed";
  amount: number | null;
  currency: string | null;
}

export interface ReleaseEligibilityResult {
  contractId: string;
  eligible: boolean;
  reason: string;
}

export interface RequestReleaseInput {
  contractId: string;
  providerReference?: string | null;
  amount: number;
  currency: string;
  /** Optional idempotency key so retries don't double-trigger. */
  idempotencyKey?: string;
}

export interface RequestReleaseResult {
  status: "requested" | "confirmed";
  providerReference: string;
}

/** Deterministic-ish mock reference generator (timestamp-based, server-side). */
function mockReference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const tail = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${stamp}${tail}`;
}

export const escrowProvider = {
  /**
   * Open a provider-side escrow "account"/intent for a case.
   * TODO(provider): integrate <licensed provider> — create an escrow hold and
   * return its canonical reference + hosted deposit instructions URL.
   */
  async createEscrowAccount(
    input: CreateEscrowAccountInput
  ): Promise<CreateEscrowAccountResult> {
    void PROVIDER_API_KEY; // present so lint flags removal when wiring real auth
    // TODO(provider): POST to provider escrow API with idempotency on caseId.
    return {
      providerReference: input.reference ?? mockReference("ESC"),
      status: "created",
      depositInstructionsUrl: null,
    };
  },

  /**
   * Look up the current deposit status for a provider reference.
   * TODO(provider): integrate <licensed provider> — GET deposit/charge status.
   */
  async getDepositStatus(ref: string): Promise<DepositStatusResult> {
    // TODO(provider): query the provider; map their status to ours.
    return {
      providerReference: ref,
      depositStatus: "awaiting",
      confirmedAmount: null,
      currency: null,
    };
  },

  /**
   * Translate an inbound provider webhook into a confirmed deposit result.
   * The caller (api/escrow/webhook) must verify the signature first.
   * TODO(provider): integrate <licensed provider> — parse the real event body.
   */
  async confirmDepositFromWebhook(
    payload: WebhookDepositPayload
  ): Promise<ConfirmDepositResult> {
    const ok =
      payload.status === "succeeded" ||
      payload.status === "received" ||
      payload.type.includes("deposit");
    return {
      providerReference: payload.providerReference,
      depositStatus: ok ? "received" : "failed",
      amount: typeof payload.amount === "number" ? payload.amount : null,
      currency: payload.currency ?? null,
    };
  },

  /**
   * Ask the provider whether a contract is releasable on their side. AEGIS also
   * enforces its own approval/dispute rules before ever calling requestRelease.
   * TODO(provider): integrate <licensed provider> — check hold/clearance state.
   */
  async checkReleaseEligibility(
    contractId: string
  ): Promise<ReleaseEligibilityResult> {
    // TODO(provider): confirm funds are cleared and not on hold.
    return {
      contractId,
      eligible: true,
      reason:
        "Mock provider reports funds are held and clear. Application-level approval/dispute rules are enforced separately before release.",
    };
  },

  /**
   * Request a release (payout) from the provider. Returns "requested" while the
   * provider processes; a webhook later confirms with "released". NEVER performs
   * a real transfer in this mock.
   * TODO(provider): integrate <licensed provider> — create a payout/release with
   * an idempotency key; return their reference.
   */
  async requestRelease(
    input: RequestReleaseInput
  ): Promise<RequestReleaseResult> {
    // TODO(provider): POST release/payout to provider using idempotencyKey.
    return {
      status: "requested",
      providerReference: input.providerReference ?? mockReference("REL"),
    };
  },

  /**
   * Verify an inbound webhook signature against the shared secret.
   * TODO(provider): integrate <licensed provider> — use their exact HMAC scheme
   * and constant-time comparison. This mock returns true only when a signature
   * and the configured secret are both present (so unsigned calls are rejected).
   */
  verifyWebhookSignature(
    rawBody: string,
    signature: string | null,
    secret: string | undefined = PROVIDER_WEBHOOK_SECRET
  ): boolean {
    void rawBody;
    // TODO(provider): compute HMAC over rawBody and timing-safe compare.
    if (!secret) return false;
    if (!signature) return false;
    return signature.length > 0;
  },
};

export type EscrowProvider = typeof escrowProvider;

/** Convenience re-export of the contract type for provider consumers. */
export type { EscrowContract };

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/escrow/webhook
//
// Inbound webhook from the LICENSED escrow/payment provider. This is how
// provider-confirmed money movement is reflected into Digital Asset Investigations — the app NEVER
// moves funds itself; it records what the provider confirms.
//
// Flow:
//  1. Read the RAW request body (needed for signature verification).
//  2. Verify the signature with escrowProvider.verifyWebhookSignature() using
//     ESCROW_PROVIDER_WEBHOOK_SECRET (server-only). Reject 401 if invalid.
//  3. Use the SERVICE-ROLE admin client (bypasses RLS) — webhooks are not a
//     user session, and updates must always succeed.
//  4. On deposit.confirmed  → deposit_status="received", escrow_status=
//     "securely_escrowed", append a confirmed "deposit" transaction.
//     On release.confirmed  → release_status="completed", escrow_status=
//     "released", mark the matching "release" transaction confirmed.
//  5. Audit every event.
//
// SECURITY: ESCROW_PROVIDER_WEBHOOK_SECRET and the service-role key are
// server-only and never reach the client.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { escrowProvider } from "@/lib/escrow/provider";
import { logAudit } from "@/lib/audit";
import { DEMO_MODE } from "@/lib/constants";
import type { EscrowContract } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WebhookEvent {
  type?: string;
  providerReference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  // ── Read the RAW body (required for signature verification) ─────────────────
  const rawBody = await request.text();

  // Provider signature header. Common header names are supported; adjust to the
  // licensed provider's exact header when wiring it in.
  // TODO(provider): use the provider's documented signature header name.
  const signature =
    request.headers.get("x-provider-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("stripe-signature");

  // ── Verify signature ────────────────────────────────────────────────────────
  const secret = process.env.ESCROW_PROVIDER_WEBHOOK_SECRET;
  const verified = escrowProvider.verifyWebhookSignature(
    rawBody,
    signature,
    secret
  );

  if (!verified) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 }
    );
  }

  // ── Parse the (now-trusted) body ────────────────────────────────────────────
  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const type = typeof event.type === "string" ? event.type : "";
  const providerReference =
    typeof event.providerReference === "string"
      ? event.providerReference
      : "";

  if (!providerReference) {
    return NextResponse.json(
      { error: "Missing providerReference." },
      { status: 400 }
    );
  }

  // ── DEMO mode short-circuit ───────────────────────────────────────────────
  if (DEMO_MODE) {
    // TODO: DEMO mode — acknowledge without touching the database.
    return NextResponse.json({ received: true, demo: true }, { status: 200 });
  }

  // ── Service-role client (bypasses RLS; webhooks have no user session) ──────
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    // Misconfiguration (missing service-role key). Do not leak details.
    return NextResponse.json(
      { error: "Server is not configured to process webhooks." },
      { status: 500 }
    );
  }

  // Resolve the escrow contract by its provider reference.
  const { data: escrow } = await supabase
    .from("escrow_contracts")
    .select("*")
    .eq("provider_reference", providerReference)
    .maybeSingle<EscrowContract>();

  if (!escrow) {
    // 200 so the provider does not retry forever for an unknown reference, but
    // log it for investigation.
    await logAudit(supabase, {
      action: "webhook.unmatched_reference",
      entityType: "escrow_contract",
      metadata: { providerReference, type },
    });
    return NextResponse.json(
      { received: true, matched: false },
      { status: 200 }
    );
  }

  const isDeposit =
    type.includes("deposit") || type === "deposit.confirmed";
  const isRelease =
    type.includes("release") || type === "release.confirmed";

  // ── deposit.confirmed ──────────────────────────────────────────────────────
  if (isDeposit) {
    const confirmation = await escrowProvider.confirmDepositFromWebhook({
      type,
      providerReference,
      amount: event.amount,
      currency: event.currency,
      status: event.status,
    });

    if (confirmation.depositStatus === "received") {
      await supabase
        .from("escrow_contracts")
        .update({
          deposit_status: "received",
          // Only advance to securely_escrowed if not in a blocking state.
          escrow_status:
            escrow.escrow_status === "under_dispute_audit" ||
            escrow.escrow_status === "release_frozen"
              ? escrow.escrow_status
              : "securely_escrowed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrow.id);

      await supabase.from("escrow_transactions").insert({
        escrow_contract_id: escrow.id,
        case_id: escrow.case_id,
        type: "deposit",
        amount: confirmation.amount ?? escrow.total_amount,
        currency: confirmation.currency ?? escrow.currency,
        provider_reference: providerReference,
        provider_status: "confirmed",
        status: "confirmed",
        initiated_by: null,
        notes: "Deposit confirmed via provider webhook.",
      });
    } else {
      await supabase
        .from("escrow_contracts")
        .update({
          deposit_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrow.id);
    }

    await logAudit(supabase, {
      caseId: escrow.case_id,
      action:
        confirmation.depositStatus === "received"
          ? "webhook.deposit_confirmed"
          : "webhook.deposit_failed",
      entityType: "escrow_contract",
      entityId: escrow.id,
      metadata: { providerReference, type },
    });

    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ── release.confirmed ───────────────────────────────────────────────────────
  if (isRelease) {
    await supabase
      .from("escrow_contracts")
      .update({
        release_status: "completed",
        escrow_status: "released",
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrow.id);

    // Mark the most recent pending "release" transaction confirmed; if none
    // exists (provider-initiated), append one.
    const { data: pendingTxn } = await supabase
      .from("escrow_transactions")
      .select("id")
      .eq("escrow_contract_id", escrow.id)
      .eq("type", "release")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (pendingTxn) {
      await supabase
        .from("escrow_transactions")
        .update({
          status: "confirmed",
          provider_status: "confirmed",
          provider_reference: providerReference,
        })
        .eq("id", pendingTxn.id);
    } else {
      await supabase.from("escrow_transactions").insert({
        escrow_contract_id: escrow.id,
        case_id: escrow.case_id,
        type: "release",
        amount: escrow.net_release_amount,
        currency: escrow.currency,
        provider_reference: providerReference,
        provider_status: "confirmed",
        status: "confirmed",
        initiated_by: null,
        notes: "Release confirmed via provider webhook.",
      });
    }

    await logAudit(supabase, {
      caseId: escrow.case_id,
      action: "webhook.release_confirmed",
      entityType: "escrow_contract",
      entityId: escrow.id,
      metadata: { providerReference, type },
    });

    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ── Unhandled event type: acknowledge + log ────────────────────────────────
  await logAudit(supabase, {
    caseId: escrow.case_id,
    action: "webhook.unhandled_event",
    entityType: "escrow_contract",
    entityId: escrow.id,
    metadata: { providerReference, type },
  });

  return NextResponse.json(
    { received: true, handled: false },
    { status: 200 }
  );
}

/** Only POST is supported. */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}

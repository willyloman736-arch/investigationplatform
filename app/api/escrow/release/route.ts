// ─────────────────────────────────────────────────────────────────────────────
// POST /api/escrow/release
//
// THE ONLY PLACE IN THE CODEBASE WHERE A RELEASE IS TRIGGERED.
//
// Flow:
//  1. Authenticate the caller (must be a signed-in user with access to the case;
//     a party to the case OR an admin).
//  2. Load the escrow contract + approvals and RE-CHECK eligibility server-side:
//       (party_a approved AND party_b approved)  OR
//       (an admin set release_eligibility_reason and release_status="eligible").
//  3. Refuse (403/409) when ineligible, frozen, under dispute, or already done.
//  4. Call escrowProvider.requestRelease() (mock; TODO(provider) to wire real).
//  5. Insert an append-only escrow_transactions row (type "release").
//  6. Set release_status="requested"; if the provider returns "confirmed", also
//     set release_status="completed" and escrow_status="released".
//  7. Audit with the acting user + reason.
//
// NO release logic lives in any client component. Money is never moved from the
// client. This route performs no balance arithmetic — it records provider-
// confirmed status only.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { escrowProvider } from "@/lib/escrow/provider";
import { logAudit } from "@/lib/audit";
import { DEMO_MODE } from "@/lib/constants";
import type {
  EscrowContract,
  Profile,
  PartyRole,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReleaseRequestBody {
  caseId?: string;
}

export async function POST(request: NextRequest) {
  // ── Parse body ───────────────────────────────────────────────────────────
  let body: ReleaseRequestBody;
  try {
    body = (await request.json()) as ReleaseRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  if (!caseId) {
    return NextResponse.json(
      { error: "caseId is required." },
      { status: 400 }
    );
  }

  // ── DEMO mode short-circuit ───────────────────────────────────────────────
  if (DEMO_MODE) {
    // TODO: DEMO mode — no Supabase session and no real provider. Return a
    // representative "requested" response so the UI can demonstrate the flow.
    return NextResponse.json(
      {
        success: true,
        demo: true,
        releaseStatus: "requested",
        message:
          "Demo mode: release request simulated. No funds moved; configure Supabase + a licensed provider for production.",
      },
      { status: 200 }
    );
  }

  const supabase = await createClient();

  // ── Authenticate ──────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Authorize: admin OR a party on the case ────────────────────────────────
  const isAdmin = profile.role === "admin";
  if (!isAdmin) {
    const { data: party } = await supabase
      .from("case_parties")
      .select("id")
      .eq("case_id", caseId)
      .eq("profile_id", profile.id)
      .maybeSingle<{ id: string }>();
    const { data: caseRow } = await supabase
      .from("cases")
      .select("created_by")
      .eq("id", caseId)
      .maybeSingle<{ created_by: string }>();
    const isParty = Boolean(party) || caseRow?.created_by === profile.id;
    if (!isParty) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  // ── Load escrow contract ────────────────────────────────────────────────────
  const { data: escrow } = await supabase
    .from("escrow_contracts")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle<EscrowContract>();

  if (!escrow) {
    return NextResponse.json(
      { error: "No escrow contract for this case." },
      { status: 404 }
    );
  }

  // ── Guard rails: already released / frozen / under dispute ─────────────────
  if (escrow.escrow_status === "released" || escrow.release_status === "completed") {
    return NextResponse.json(
      { error: "This escrow has already been released." },
      { status: 409 }
    );
  }
  if (escrow.escrow_status === "release_frozen") {
    return NextResponse.json(
      { error: "Release is frozen by an administrator." },
      { status: 409 }
    );
  }
  if (escrow.escrow_status === "under_dispute_audit") {
    return NextResponse.json(
      { error: "Release is blocked while a dispute is under review." },
      { status: 409 }
    );
  }
  if (escrow.deposit_status !== "received") {
    return NextResponse.json(
      { error: "Funds have not been confirmed as deposited yet." },
      { status: 409 }
    );
  }

  // ── RE-CHECK eligibility server-side (do not trust the client) ─────────────
  const { data: approvals } = await supabase
    .from("approvals")
    .select("party_role, approved")
    .eq("case_id", caseId);

  const approvedRole = (role: PartyRole): boolean =>
    Boolean(approvals?.some((a) => a.party_role === role && a.approved));

  const bothPartiesApproved =
    approvedRole("party_a") && approvedRole("party_b");

  const adminEligibility =
    escrow.release_status === "eligible" &&
    Boolean(escrow.release_eligibility_reason);

  const eligible = bothPartiesApproved || adminEligibility;

  if (!eligible) {
    return NextResponse.json(
      {
        error:
          "Release is not eligible: both parties must approve, or an admin must resolve a dispute to release.",
      },
      { status: 403 }
    );
  }

  const eligibilityReason = bothPartiesApproved
    ? "Both parties approved the release."
    : escrow.release_eligibility_reason ?? "Admin-approved release eligibility.";

  // ── Provider-side eligibility (defense in depth) ───────────────────────────
  // The provider also confirms funds are cleared and not on hold. Our app-level
  // rules above are the primary gate.
  const providerEligibility = await escrowProvider.checkReleaseEligibility(
    escrow.id
  );
  if (!providerEligibility.eligible) {
    return NextResponse.json(
      { error: `Provider blocked the release: ${providerEligibility.reason}` },
      { status: 409 }
    );
  }

  // ── Trigger the release through the provider abstraction ────────────────────
  // TODO(provider): integrate <licensed provider> — this returns "requested"
  // until the provider confirms via the webhook (release.confirmed).
  const result = await escrowProvider.requestRelease({
    contractId: escrow.id,
    providerReference: escrow.provider_reference,
    amount: escrow.net_release_amount,
    currency: escrow.currency,
    idempotencyKey: `release_${escrow.id}`,
  });

  const providerConfirmed = result.status === "confirmed";

  // ── Append the release transaction to the ledger (no balance math) ─────────
  const { data: txn } = await supabase
    .from("escrow_transactions")
    .insert({
      escrow_contract_id: escrow.id,
      case_id: caseId,
      type: "release",
      amount: escrow.net_release_amount,
      currency: escrow.currency,
      provider_reference: result.providerReference,
      provider_status: result.status,
      status: providerConfirmed ? "confirmed" : "pending",
      initiated_by: profile.id,
      notes: eligibilityReason,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  // ── Advance escrow state ────────────────────────────────────────────────────
  const escrowPatch = providerConfirmed
    ? {
        release_status: "completed" as const,
        escrow_status: "released" as const,
        provider_reference: result.providerReference,
        updated_at: new Date().toISOString(),
      }
    : {
        release_status: "requested" as const,
        provider_reference: result.providerReference,
        updated_at: new Date().toISOString(),
      };

  await supabase
    .from("escrow_contracts")
    .update(escrowPatch)
    .eq("id", escrow.id);

  // ── Audit ───────────────────────────────────────────────────────────────────
  await logAudit(supabase, {
    actorId: profile.id,
    caseId,
    action: providerConfirmed
      ? "escrow.release_completed"
      : "escrow.release_requested",
    entityType: "escrow_contract",
    entityId: escrow.id,
    metadata: {
      providerReference: result.providerReference,
      providerStatus: result.status,
      transactionId: txn?.id ?? null,
      via: bothPartiesApproved ? "mutual_approval" : "admin_eligibility",
    },
    reason: eligibilityReason,
  });

  return NextResponse.json(
    {
      success: true,
      releaseStatus: providerConfirmed ? "completed" : "requested",
      providerReference: result.providerReference,
      transactionId: txn?.id ?? null,
    },
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

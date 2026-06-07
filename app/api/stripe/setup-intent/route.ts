import { NextResponse, type NextRequest } from "next/server";

import { DEMO_MODE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { EscrowContract, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SetupIntentBody {
  caseId?: string;
}

export async function POST(request: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json(
      { error: "Stripe setup is unavailable in demo mode." },
      { status: 503 }
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Stripe provider is not configured." },
      { status: 503 }
    );
  }

  let body: SetupIntentBody;
  try {
    body = (await request.json()) as SetupIntentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }

  const supabase = await createClient();
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
  if (!profile || !profile.is_verified) {
    return NextResponse.json(
      { error: "KYC verification is required before card payout setup." },
      { status: 403 }
    );
  }

  const { data: escrow } = await supabase
    .from("escrow_contracts")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle<EscrowContract>();

  const escrowReady =
    escrow?.escrow_status === "ready_for_release" ||
    escrow?.escrow_status === "release_approved";
  if (
    !escrow ||
    !escrowReady ||
    escrow.release_status !== "eligible" ||
    Number(escrow.net_release_amount ?? 0) <= 0
  ) {
    return NextResponse.json(
      { error: "This escrow account is not eligible for card payout setup." },
      { status: 409 }
    );
  }

  const params = new URLSearchParams();
  params.set("usage", "off_session");
  params.set("metadata[user_id]", user.id);
  params.set("metadata[case_id]", caseId);
  params.set("metadata[escrow_contract_id]", escrow.id);
  params.set("metadata[purpose]", "withdrawal_card_payout");

  const response = await fetch("https://api.stripe.com/v1/setup_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const payload = (await response.json()) as {
    client_secret?: string;
    id?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.client_secret) {
    return NextResponse.json(
      { error: payload.error?.message ?? "Could not initialize Stripe setup." },
      { status: response.status || 500 }
    );
  }

  return NextResponse.json({
    clientSecret: payload.client_secret,
    setupIntentId: payload.id,
  });
}

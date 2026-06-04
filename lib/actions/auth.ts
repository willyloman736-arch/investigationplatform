"use server";

/**
 * Authentication server actions (Supabase Auth).
 *
 * SERVER-ONLY. These run on the server via the form `action` prop. They use the
 * cookie-bound Supabase server client so the auth session is persisted in
 * HTTP-only cookies (refreshed by middleware on every request).
 *
 * Honest-copy note: we do NOT implement custom encryption here. Auth, password
 * hashing, and session security are handled by Supabase Auth + standard cookie
 * security. Do not claim more than that in UI copy.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { DEMO_MODE, PLATFORM_FEE_RATE, PROVIDER_FEE_RATE } from "@/lib/constants";
import { hashPhrase } from "@/lib/recovery/hash";
import {
  normalizeRecoveryPhrase,
  validateRecoveryPhrase,
} from "@/lib/recovery/phrase";
import type { UserRole } from "@/lib/types";

type SignupIntent = "file_case" | "open_escrow";

/**
 * Shape returned to the client form on failure. On success the action redirects
 * (which throws internally), so callers never receive a success object — they
 * only ever see `{ error }` when something goes wrong.
 */
export interface AuthResult {
  error?: string;
  /** signUp resolves with success:true (instead of redirecting like signIn) so
   *  the client can reveal the one-time recovery phrase before navigating. */
  success?: boolean;
}

// ── Validation schemas ───────────────────────────────────────────────────────

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(120, "That name is too long."),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
  // Self-service registration is limited to client / counterparty. Admin roles
  // are provisioned out-of-band; never let a user self-assign admin.
  role: z.enum(["client", "counterparty"], {
    errorMap: () => ({ message: "Select an account type." }),
  }),
});

/**
 * Translate a raw Supabase auth error into a readable, non-leaky message.
 * We avoid echoing provider internals and never confirm whether an email exists.
 */
function readableAuthError(message: string | undefined): string {
  const msg = (message ?? "").toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox.";
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("password")) {
    return "Password does not meet the requirements. Use at least 8 characters.";
  }
  return "Something went wrong. Please try again.";
}

/** Only allow internal, single-slash paths as post-login redirects (no open
 *  redirects). The operator console passes "/admin"; default is "/dashboard". */
function sanitizeRedirectPath(path: string): string {
  if (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("://") &&
    !path.includes("\\")
  ) {
    return path;
  }
  return "/dashboard";
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function formMoney(formData: FormData, name: string): number {
  const raw = formText(formData, name).replace(/,/g, "");
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function titleCaseSlug(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function createSignupWorkspace(input: {
  userId: string;
  email: string;
  fullName: string;
  formData: FormData;
}) {
  const intent = formText(input.formData, "intent") as SignupIntent;
  if (intent !== "file_case" && intent !== "open_escrow") return;

  const admin = createAdminClient();
  await admin.from("profiles").upsert(
    {
      id: input.userId,
      email: input.email,
      full_name: input.fullName,
      role: "client",
    },
    { onConflict: "id" }
  );

  const year = new Date().getUTCFullYear();
  const { count } = await admin
    .from("cases")
    .select("id", { count: "exact", head: true });
  const caseNumber = `AEG-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const amount =
    intent === "file_case"
      ? formMoney(input.formData, "amountLost")
      : formMoney(input.formData, "escrowAmount");
  const escrowAmount = intent === "file_case" ? 0 : amount;
  const platformFee = round2(escrowAmount * PLATFORM_FEE_RATE);
  const providerFee = round2(escrowAmount * PROVIDER_FEE_RATE);
  const netRelease = round2(escrowAmount - platformFee - providerFee);

  const scamType = titleCaseSlug(formText(input.formData, "scamType"));
  const platform = formText(input.formData, "platform");
  const incidentDate = formText(input.formData, "incidentDate");
  const asset = formText(input.formData, "asset");
  const walletTx = formText(input.formData, "walletTx");
  const description = formText(input.formData, "description");
  const dealTitle = formText(input.formData, "dealTitle");
  const counterpartyEmail = formText(input.formData, "counterpartyEmail");
  const escrowRole = formText(input.formData, "escrowRole");
  const feePayer = formText(input.formData, "feePayer");

  const casePayload =
    intent === "file_case"
      ? {
          title: `Crypto scam complaint - ${scamType || "New file"}`,
          category: scamType ? `Crypto Scam - ${scamType}` : "Crypto Scam",
          description: [
            description,
            amount ? `Amount reported lost: $${amount.toLocaleString("en-US")}` : "",
            platform ? `Platform/person: ${platform}` : "",
            incidentDate ? `Incident date: ${incidentDate}` : "",
            asset ? `Asset involved: ${asset}` : "",
            walletTx ? `Wallets / transaction hashes:\n${walletTx}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          contract_terms:
            "Initial complaint review is free. Admins review evidence, may request KYC or more documents, and only reflect recovered funds in escrow after internal/provider confirmation.",
        }
      : {
          title: dealTitle || "Secure escrow request",
          category: "Secure Escrow Request",
          description: [
            `Escrow role: ${escrowRole || "client"}`,
            counterpartyEmail ? `Counterparty email: ${counterpartyEmail}` : "",
            amount ? `Requested escrow amount: $${amount.toLocaleString("en-US")}` : "",
            feePayer ? `Fee payer: ${feePayer}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          contract_terms:
            "Escrow request is pending admin review. Funds are not moved by the browser; provider-confirmed deposits and releases are recorded server-side.",
        };

  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .insert({
      case_number: caseNumber,
      title: casePayload.title,
      description: casePayload.description || null,
      category: casePayload.category,
      status: "draft",
      created_by: input.userId,
      contract_terms: casePayload.contract_terms,
    })
    .select("id")
    .single<{ id: string }>();

  if (caseError || !caseRow) {
    throw new Error(caseError?.message ?? "Could not create your case.");
  }

  await admin.from("escrow_contracts").insert({
    case_id: caseRow.id,
    currency: "USD",
    total_amount: escrowAmount,
    platform_fee: platformFee,
    provider_fee: providerFee,
    net_release_amount: netRelease,
    escrow_status: "pending_deposit",
    deposit_status: "awaiting",
    release_status: "not_started",
  });

  await admin.from("recovery_kyc_reviews").upsert(
    {
      case_id: caseRow.id,
      profile_id: input.userId,
      status: "not_started",
      government_id_status: "not_submitted",
      selfie_status: "not_submitted",
      proof_of_address_status: "not_submitted",
      phone_verified: false,
      email_verified: true,
      review_note: "KYC required automatically after case intake.",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "case_id" }
  );

  const parties: {
    case_id: string;
    profile_id: string | null;
    invited_email: string;
    party_role: "party_a" | "party_b";
    accepted: boolean;
  }[] = [
    {
      case_id: caseRow.id,
      profile_id: input.userId,
      invited_email: input.email,
      party_role: "party_a",
      accepted: true,
    },
  ];
  if (intent === "open_escrow" && counterpartyEmail) {
    parties.push({
      case_id: caseRow.id,
      profile_id: null,
      invited_email: counterpartyEmail,
      party_role: "party_b",
      accepted: false,
    });
  }
  await admin.from("case_parties").insert(parties);

  await logAudit(admin, {
    actorId: input.userId,
    caseId: caseRow.id,
    action:
      intent === "file_case"
        ? "case.signup_complaint_created"
        : "case.signup_escrow_created",
    entityType: "case",
    entityId: caseRow.id,
    metadata: { caseNumber, intent, amount },
  });
}

// ── Sign in ──────────────────────────────────────────────────────────────────

/**
 * Sign an existing user in with email + password.
 * On success: writes a best-effort login audit row and redirects to /dashboard.
 * On failure: returns { error } for the form to render.
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
  }

  // Where to land after sign-in (sanitized). Operator console passes "/admin".
  const rawRedirect = formData.get("redirectTo");
  const target = sanitizeRedirectPath(
    typeof rawRedirect === "string" ? rawRedirect : ""
  );

  // DEMO path: when previewing without Supabase configured, skip real auth so
  // the dashboard is reachable. MUST be disabled in production.
  // TODO(demo): remove this bypass for production — DEMO_MODE must be false.
  if (DEMO_MODE) {
    redirect(target);
  }

  // No database configured on this deployment (and not in demo mode): return a
  // clear, actionable message instead of throwing, so the form never appears
  // "unresponsive".
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      error:
        "Sign-in isn't available on this deployment yet — no database is configured. Enable demo mode (NEXT_PUBLIC_DEMO_MODE=true) or add your Supabase keys, then redeploy.",
    };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return { error: readableAuthError(error.message) };
    }

    // Best-effort audit of the login event (never throws).
    if (data.user) {
      await logAudit(supabase, {
        actorId: data.user.id,
        action: "auth.sign_in",
        entityType: "auth_user",
        entityId: data.user.id,
        metadata: { email: parsed.data.email },
      });
    }

    revalidatePath("/", "layout");
  } catch {
    return {
      error:
        "Sign-in is temporarily unavailable. Please check your connection and try again.",
    };
  }

  // Outside the try so the redirect's control-flow signal is never swallowed.
  redirect(target);
}

// ── Sign up ──────────────────────────────────────────────────────────────────

/**
 * Register a new client / counterparty account.
 *
 * The `profiles` row is normally created by a database trigger on auth.users
 * insert. We pass full_name + role through `options.data` (user metadata) so the
 * trigger can populate them, and we ALSO upsert the profile as a best-effort
 * fallback in case the trigger is not installed in a given environment.
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  // The recovery phrase is generated in the user's browser and sent once over
  // HTTPS so we can store ONLY its hash. We never persist or log the phrase.
  const rawPhrase = formData.get("recoveryPhrase");
  const recoveryPhrase =
    typeof rawPhrase === "string" ? normalizeRecoveryPhrase(rawPhrase) : "";
  if (!validateRecoveryPhrase(recoveryPhrase)) {
    return {
      error:
        "Could not establish your recovery phrase. Please refresh and try again.",
    };
  }

  const { fullName, email, password, role } = parsed.data;

  // DEMO path: skip real account creation, but still resolve with success so the
  // client can show the (client-generated) recovery-phrase reveal step.
  // TODO(demo): remove this bypass for production — DEMO_MODE must be false.
  if (DEMO_MODE) {
    return { success: true };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      error:
        "Registration isn't available on this deployment yet — no database is configured. Enable demo mode or add your Supabase keys, then redeploy.",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Consumed by the DB trigger to seed the profiles row.
      data: {
        full_name: fullName,
        role: role satisfies UserRole,
      },
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      }/auth/callback`,
    },
  });

  if (error) {
    return { error: readableAuthError(error.message) };
  }

  if (data.user) {
    // Fallback profile upsert (the auth.users trigger is the source of truth).
    // RLS must allow a user to upsert their own profile row (id = auth.uid()).
    try {
      await supabase.from("profiles").upsert(
        { id: data.user.id, email, full_name: fullName, role },
        { onConflict: "id" }
      );
    } catch {
      // Non-fatal: swallow so a missing RLS grant never blocks registration.
    }

    // Store ONLY the scrypt hash of the recovery phrase, in a service-role-only
    // table the browser can never read. Best-effort: a failure here must never
    // strand a created account (the user can still sign in with their password).
    try {
      const admin = createAdminClient();
      const phraseHash = await hashPhrase(recoveryPhrase);
      await admin.from("account_recovery").upsert(
        {
          profile_id: data.user.id,
          phrase_hash: phraseHash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );
    } catch {
      // Non-fatal: account exists; recovery-by-phrase just won't be available.
    }

    try {
      await createSignupWorkspace({
        userId: data.user.id,
        email,
        fullName,
        formData,
      });
    } catch {
      // Non-fatal: account exists; admins can still create/assign the case.
    }

    await logAudit(supabase, {
      actorId: data.user.id,
      action: "auth.sign_up",
      entityType: "profile",
      entityId: data.user.id,
      metadata: { email, role },
    });
  }

  // Resolve with success so the client reveals the recovery phrase, then routes
  // to /dashboard (middleware bounces to /login if email confirmation is on).
  revalidatePath("/", "layout");
  return { success: true };
}

// ── Sign out ─────────────────────────────────────────────────────────────────

/**
 * Sign the current user out and return them to the login screen.
 */
export async function signOut(): Promise<void> {
  // TODO(demo): in DEMO_MODE there is no real session; just bounce to /login.
  if (DEMO_MODE) {
    redirect("/login");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await logAudit(supabase, {
      actorId: user.id,
      action: "auth.sign_out",
      entityType: "auth_user",
      entityId: user.id,
    });
  }

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}

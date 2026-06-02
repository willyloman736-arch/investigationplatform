import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/**
 * OAuth / email-confirmation callback.
 *
 * Supabase redirects here with a `?code=` (PKCE) after the user confirms their
 * email or completes an OAuth flow. We exchange that code for a session (which
 * sets the auth cookies via the server client), then redirect into the app.
 *
 * `?next=` is honored only for SAME-ORIGIN, path-style destinations to avoid
 * open-redirect abuse; anything else falls back to /dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  // Provider returned an explicit error (e.g. expired/used link).
  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (data.user) {
        await logAudit(supabase, {
          actorId: data.user.id,
          action: "auth.callback_confirmed",
          entityType: "auth_user",
          entityId: data.user.id,
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or exchange failed — send the user back to sign in with a hint.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "We could not complete sign-in. Please try again."
    )}`
  );
}

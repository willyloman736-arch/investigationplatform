import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on each request and returns both the
 * resulting response (with refreshed cookies) and the authenticated user.
 *
 * The root middleware.ts uses the returned `user` to enforce route guards and
 * returns `response` so refreshed auth cookies propagate to the browser.
 *
 * IMPORTANT: do not run logic between createServerClient and getUser() — it can
 * desync the session and randomly log users out (per Supabase SSR guidance).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If env is not configured (e.g. demo/preview), do not attempt auth — just
  // pass the request through. The root middleware handles DEMO_MODE bypass.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { response: supabaseResponse, user: null };
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the session. Must be called immediately after client creation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}

// NEVER import in a client component.
// This module reads server-only cookies and (in createAdminClient) the
// SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security. Importing it
// into client code would leak privileged credentials to the browser.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client bound to the request cookies (Next 14 pattern
 * using getAll/setAll). Respects Row Level Security — use this for normal
 * user-scoped reads/writes in Server Components, server actions, and route
 * handlers.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component. This can
            // be ignored if middleware refreshes user sessions (see
            // lib/supabase/middleware.ts).
          }
        },
      },
    }
  );
}

/**
 * Privileged Supabase client using the SERVICE ROLE key. Bypasses RLS.
 * SERVER-ONLY. Use sparingly and only for trusted operations (e.g. webhook
 * confirmation of provider events, audit writes that must always succeed).
 * NEVER import this into a client component.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. createAdminClient() is server-only and requires the service role key."
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

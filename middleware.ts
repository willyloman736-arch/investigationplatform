import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route guard for /dashboard and /admin.
 *
 * - When NEXT_PUBLIC_DEMO_MODE === "true": the guard is BYPASSED so the app is
 *   viewable from mock data without Supabase configured. DEMO ONLY — this MUST
 *   be "false" (or unset) in production.
 * - Otherwise: unauthenticated users are redirected to /login; authenticated
 *   non-admins hitting /admin are redirected to /dashboard.
 *
 * Admin determination: we read the user's role from app_metadata/user_metadata
 * (set at signup / by an admin). This avoids a DB round-trip in middleware.
 */
// Demo mode is ON when explicitly enabled, OR when no Supabase URL is
// configured (a fresh deploy is a working showcase, not a broken login). Adding
// a real NEXT_PUBLIC_SUPABASE_URL turns the auth guard back on automatically.
const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");

  // Demo bypass: still refresh the session (no-op if env missing) but never
  // block access.
  if (DEMO_MODE) {
    const { response } = await updateSession(request);
    return response;
  }

  const { response, user } = await updateSession(request);

  // Not authenticated → send to login, preserving intended destination.
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes: non-admins are redirected to their dashboard.
  if (isAdminRoute) {
    const role =
      (user.app_metadata?.role as string | undefined) ??
      (user.user_metadata?.role as string | undefined);
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

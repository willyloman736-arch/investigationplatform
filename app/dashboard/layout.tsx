// ─────────────────────────────────────────────────────────────────────────────
// Client dashboard layout (Server Component).
//
// Resolves the signed-in user and renders the shared <DashboardLayout> app shell
// (Sidebar + Topbar + responsive drawer). In DEMO mode there is no Supabase
// session, so we fall back to a mock "client" user (getCurrentUserMock) so the
// experience is fully viewable without Supabase configured.
//
// Auth/route protection itself is handled by middleware.ts (which also bypasses
// the guard when NEXT_PUBLIC_DEMO_MODE === "true"). This layout only resolves the
// user for display; it never moves money or performs mutations.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";

import { DEMO_MODE } from "@/lib/constants";
import { getCurrentUserMock } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Profile, SessionUser } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

/**
 * Resolve the current user's profile for the dashboard shell.
 *
 * - DEMO mode: return the deterministic mock client profile.
 * - Production: read auth.getUser() + the profiles row. If there is no session,
 *   send the user to /login.
 */
async function resolveDashboardUser(): Promise<Profile> {
  if (DEMO_MODE) {
    return getCurrentUserMock("client");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await resolveDashboardUser();

  const sessionUser: SessionUser = {
    name: profile.full_name ?? profile.company ?? profile.email,
    email: profile.email,
    role: profile.role,
    avatar_url: profile.avatar_url,
    company: profile.company,
    phone: profile.phone,
  };

  return (
    <DashboardLayout role={profile.role} user={sessionUser}>
      {children}
    </DashboardLayout>
  );
}

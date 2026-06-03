// ─────────────────────────────────────────────────────────────────────────────
// Admin layout — guards the entire /admin command center.
//
// In production this verifies the signed-in user is an administrator via the
// Supabase server client; non-admins are redirected to /dashboard and signed-out
// visitors to /login. (middleware.ts is the first gate; this is defense-in-depth
// at the route level.)
//
// In DEMO mode there is no Supabase session, so we render with the mock admin
// profile (getCurrentUserMock("admin")) so the command center is fully viewable
// without Supabase configured. DEMO_MODE must be false in production.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { redirect } from "next/navigation";

import { DEMO_MODE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserMock } from "@/lib/data";
import type { Profile, SessionUser } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await resolveAdminProfile();

  // Not an admin → bounce to the client dashboard (or login if unauthenticated).
  if (!profile) {
    redirect(DEMO_MODE ? "/dashboard" : "/login");
  }
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const user: SessionUser = {
    name: profile.full_name ?? profile.company ?? profile.email,
    email: profile.email,
    role: profile.role,
    avatar_url: profile.avatar_url,
    company: profile.company,
    phone: profile.phone,
  };

  return (
    <DashboardLayout role="admin" user={user}>
      {children}
    </DashboardLayout>
  );
}

/**
 * Resolve the current admin profile.
 *
 * DEMO: return the mock admin so the area renders without Supabase.
 * PROD: load auth.getUser() + the profiles row.
 *
 * TODO: when wiring real auth, this is the production query already implemented
 * below — only the DEMO short-circuit needs removing.
 */
async function resolveAdminProfile(): Promise<Profile | null> {
  if (DEMO_MODE) {
    return getCurrentUserMock("admin");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return data ?? null;
}

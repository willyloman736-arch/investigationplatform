import * as React from "react";
import { FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/constants";
import type { SessionUser, UserRole } from "@/lib/types";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";

export interface DashboardLayoutProps {
  role: UserRole;
  user: SessionUser;
  /** Optional page title surfaced in the Topbar. */
  title?: string;
  children: React.ReactNode;
}

/**
 * App shell for the authenticated experience.
 *
 * Layout: a fixed-width Sidebar rail on lg+ screens, with a Topbar (containing
 * the mobile drawer trigger) and a scrollable main column. The grid uses
 * `min-w-0` and `overflow-x-hidden` guards so long tables/content never force
 * horizontal page overflow on mobile.
 *
 * This is a Server Component; the interactive bits (Sidebar nav, Topbar menu,
 * MobileDrawer) are client components composed in.
 */
export function DashboardLayout({
  role,
  user,
  title,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="relative min-h-svh bg-background text-foreground">
      {/* Subtle ambient glow — institutional, not flashy. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="flex min-h-svh">
        {/* Desktop sidebar rail */}
        <aside className="hidden w-64 shrink-0 border-r border-white/8 lg:block">
          <div className="sticky top-0 h-svh">
            <Sidebar role={role} />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} title={title} role={role} />

          {DEMO_MODE ? <DemoModeBanner /> : null}

          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Thin demo banner shown when NEXT_PUBLIC_DEMO_MODE === "true". The shell also
 * renders a compact "Demo Mode" pill so it is obvious the data is mock and the
 * auth guard is bypassed. This MUST be false in production.
 */
function DemoModeBanner() {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300 sm:px-6"
      )}
      role="status"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold uppercase tracking-wide">
        <FlaskConical className="h-3 w-3" aria-hidden="true" />
        Demo Mode
      </span>
      <span className="text-amber-200/90">
        Preview only — data is mock and the auth guard is bypassed. Disable in
        production.
      </span>
    </div>
  );
}

export default DashboardLayout;

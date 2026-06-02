"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ADMIN, NAV_CLIENT, PROVIDER_DISCLAIMER } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import { Logo } from "@/components/shared/Logo";
import { signOut } from "@/lib/actions/auth";

export interface SidebarProps {
  role: UserRole;
  /** Optional callback fired when a nav item is clicked (used by the mobile drawer to close itself). */
  onNavigate?: () => void;
  className?: string;
}

/**
 * Returns the nav config for the active role. Admins get the admin command
 * center; clients and counterparties share the client nav.
 */
function navForRole(role: UserRole) {
  return role === "admin" ? NAV_ADMIN : NAV_CLIENT;
}

/**
 * Determine whether a nav href is "active" for the current pathname.
 * The dashboard/command-center roots match exactly; deeper sections match by
 * prefix so e.g. /dashboard/cases/abc still highlights "Cases".
 */
function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Persistent left navigation. Rendered inline on desktop by DashboardLayout and
 * reused (without its own width/border chrome) inside the mobile drawer.
 */
export function Sidebar({ role, onNavigate, className }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const items = navForRole(role);

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2 bg-card/60 backdrop-blur-md",
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link
          href={role === "admin" ? "/admin" : "/dashboard"}
          onClick={onNavigate}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Go to dashboard home"
        >
          <Logo href={null} />
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActiveHref(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
              {active ? (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer: disclaimer + sign out */}
      <div className="mt-auto space-y-3 border-t border-white/8 px-3 py-4">
        <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/80">
          {PROVIDER_DISCLAIMER}
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors",
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              "focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Sidebar;

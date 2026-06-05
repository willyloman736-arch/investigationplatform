"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileCheck2,
  LogOut,
  ReceiptText,
  ScrollText,
  Search,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NAV_ADMIN,
  NAV_CLIENT,
  PROVIDER_DISCLAIMER,
  type NavItem,
} from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import { Logo } from "@/components/shared/Logo";
import { Icon3D } from "@/components/shared/Icon3D";
import { signOut } from "@/lib/actions/auth";

export interface SidebarProps {
  role: UserRole;
  /** Optional callback fired when a nav item is clicked (used by the mobile drawer to close itself). */
  onNavigate?: () => void;
  className?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_OPERATIONS_NAV: NavItem[] = [
  { label: "Withdrawal Queue", href: "/admin/withdrawals", icon: CreditCard },
  { label: "Receipts", href: "/admin#receipts", icon: ReceiptText },
  { label: "Escrow Ledger", href: "/admin#escrow-ledger", icon: Wallet },
  { label: "Audit Logs", href: "/admin#audit-logs", icon: ScrollText },
  { label: "Release Checks", href: "/admin/cases", icon: FileCheck2 },
];

function navGroupsForRole(role: UserRole): NavGroup[] {
  if (role === "admin") {
    return [
      { label: "Main menu", items: NAV_ADMIN },
      { label: "Operations", items: ADMIN_OPERATIONS_NAV },
    ];
  }

  return [{ label: "Workspace", items: NAV_CLIENT }];
}

function isActiveHref(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  if (href === "/dashboard" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role, onNavigate, className }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const groups = navGroupsForRole(role);
  const homeHref = role === "admin" ? "/admin" : "/dashboard";

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-card/55 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex min-h-20 shrink-0 items-center px-4">
        <Link
          href={homeHref}
          onClick={onNavigate}
          className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Go to dashboard home"
        >
          <Logo href={null} />
        </Link>
      </div>

      {role === "admin" ? (
        <div className="px-3 pb-3">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs text-muted-foreground shadow-sm shadow-black/10">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Search cases, clients, receipts</span>
          </div>
        </div>
      ) : null}

      <nav
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4"
        aria-label="Primary"
      >
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon as LucideIcon;
                const active = isActiveHref(pathname, item.href);
                return (
                  <Link
                    key={`${group.label}-${item.href}-${item.label}`}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border border-primary/25 bg-primary/15 text-primary shadow-lg shadow-primary/5"
                        : "border border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.055] hover:text-foreground"
                    )}
                  >
                    <Icon3D icon={Icon} tone="blue" size={26} />
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
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-white/8 px-3 py-4">
        {role === "admin" ? (
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.07] p-3">
            <p className="text-xs font-semibold text-foreground">
              Protected release flow
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {PROVIDER_DISCLAIMER}
            </p>
          </div>
        ) : (
          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/80">
            {PROVIDER_DISCLAIMER}
          </p>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium outline-none transition-colors",
              "text-muted-foreground hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive",
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

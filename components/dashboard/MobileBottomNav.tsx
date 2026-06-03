"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Menu,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import { MobileDrawer } from "@/components/dashboard/MobileDrawer";

const CLIENT_ITEMS = [
  { label: "Escrow", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cases", href: "/dashboard/cases", icon: FolderKanban },
  { label: "Profile", href: "/dashboard/profile", icon: UserRound },
];

const ADMIN_ITEMS = [
  { label: "Command", href: "/admin", icon: Gauge },
  { label: "Cases", href: "/admin/cases", icon: FolderKanban },
  { label: "Disputes", href: "/admin/disputes", icon: ShieldAlert },
];

export function MobileBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname() ?? "";
  const items = role === "admin" ? ADMIN_ITEMS : CLIENT_ITEMS;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/85 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:hidden">
      <nav className="mx-auto grid max-w-md grid-cols-4 gap-1" aria-label="Mobile dashboard">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard" || item.href === "/admin"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-semibold transition-colors",
                active
                  ? "border border-primary/25 bg-primary/15 text-primary"
                  : "border border-transparent text-muted-foreground hover:bg-white/[0.055] hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <MobileDrawer
          role={role}
          trigger={
            <button
              type="button"
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl border border-transparent px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/[0.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              <span>Menu</span>
            </button>
          }
        />
      </nav>
    </div>
  );
}

export default MobileBottomNav;

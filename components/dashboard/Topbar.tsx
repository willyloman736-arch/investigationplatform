"use client";

import * as React from "react";
import { LogOut, Search, ShieldCheck, User2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SessionUser, UserRole } from "@/lib/types";
import { signOut } from "@/lib/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileDrawer } from "@/components/dashboard/MobileDrawer";

export interface TopbarProps {
  user: SessionUser;
  /** Page title shown on the left (desktop). Optional. */
  title?: string;
  /** Show the search field (desktop). Decorative for the MVP. */
  showSearch?: boolean;
  /** Role drives the mobile drawer nav. Defaults to the user's role. */
  role?: UserRole;
}

/** Build up to two uppercase initials from a name (falls back to email). */
function initialsFrom(name: string, email: string): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "AE";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const ROLE_LABEL: Record<UserRole, string> = {
  client: "Client",
  counterparty: "Operator",
  admin: "Administrator",
};

/**
 * Sticky top bar: mobile nav trigger + page title (left), search + account menu
 * (right). The account dropdown is the canonical sign-out affordance on mobile.
 */
export function Topbar({ user, title, showSearch = true, role }: TopbarProps) {
  const initials = initialsFrom(user.name, user.email);
  const activeRole = role ?? user.role;
  const displayTitle = title ?? (activeRole === "admin" ? "Command Center" : undefined);
  const searchPlaceholder =
    activeRole === "admin"
      ? "Search cases, clients, receipts..."
      : "Search cases...";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/8 bg-background/[0.72] px-4 shadow-sm shadow-black/10 backdrop-blur-xl sm:px-6">
      {/* Mobile: drawer trigger */}
      <MobileDrawer role={role ?? user.role} />

      {/* Title */}
      {displayTitle ? (
        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
          {displayTitle}
        </h1>
      ) : (
        <span className="sr-only">Dashboard</span>
      )}

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {showSearch ? (
          <div className="relative hidden md:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-64 rounded-xl border-white/10 bg-white/[0.055] pl-9 shadow-sm shadow-black/10"
            />
          </div>
        ) : null}

        {activeRole === "admin" ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary lg:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Admin control
          </span>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className={cn(
                "flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors",
                "hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Avatar className="h-9 w-9 border border-white/10">
                <AvatarImage src={undefined} alt="" />
                <AvatarFallback className="bg-primary/15 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-1 py-2">
              <span className="truncate text-sm font-medium text-foreground">
                {user.name || "Account"}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-primary" aria-hidden="true" />
                {ROLE_LABEL[user.role]}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground">
              <User2 className="h-4 w-4" aria-hidden="true" />
              <span>Profile (coming soon)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Sign out goes through the server action, never client-side auth. */}
            <form action={signOut}>
              <button
                type="submit"
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Topbar;

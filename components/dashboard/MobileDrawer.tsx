"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import type { UserRole } from "@/lib/types";
import { APP_NAME } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "@/components/dashboard/Sidebar";

export interface MobileDrawerProps {
  role: UserRole;
  /** Optional custom trigger. Defaults to a hamburger icon button (lg:hidden). */
  trigger?: React.ReactNode;
}

/**
 * Sheet-based off-canvas navigation for mobile/tablet. Reuses <Sidebar /> so the
 * nav stays in sync with the desktop rail. Closes automatically on navigation
 * via the controlled `open` state + Sidebar's onNavigate callback.
 */
export function MobileDrawer({ role, trigger }: MobileDrawerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label="Open navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-white/8 bg-card p-0"
      >
        {/* Accessible title for the dialog; visually hidden since the Logo is shown inside Sidebar. */}
        <SheetTitle className="sr-only">{APP_NAME} navigation</SheetTitle>
        <Sidebar role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export default MobileDrawer;

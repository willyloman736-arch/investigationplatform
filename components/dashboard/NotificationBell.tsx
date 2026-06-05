"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PushOptIn } from "@/components/dashboard/PushOptIn";

const PAGE_SIZE = 20;

/**
 * Live notification bell. Fetches the user's recent notifications, subscribes to
 * Supabase Realtime for INSERT/UPDATE on their rows, shows a toast on new ones,
 * and exposes mark-read / mark-all-read + the Web Push opt-in.
 *
 * Resolves the current user via the browser client's auth.getUser(), so no id
 * needs to be threaded through the layout. Renders inertly when Supabase isn't
 * configured (e.g. demo mode).
 */
export function NotificationBell() {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);

  const unread = React.useMemo(
    () => items.filter((n) => !n.read_at).length,
    [items]
  );

  React.useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (active && data) setItems(data as Notification[]);

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as Notification;
            setItems((prev) =>
              prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 50)
            );
            toast(n.title, { description: n.body });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as Notification;
            setItems((prev) => prev.map((p) => (p.id === n.id ? n : p)));
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markRead = async (n: Notification) => {
    if (n.read_at) return;
    setItems((prev) =>
      prev.map((p) =>
        p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p
      )
    );
    await markNotificationRead(n.id);
  };

  const markAll = async () => {
    setItems((prev) =>
      prev.map((p) =>
        p.read_at ? p : { ...p, read_at: new Date().toISOString() }
      )
    );
    await markAllNotificationsRead();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <span className="text-sm font-semibold text-foreground">
            Notifications
          </span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((n) => {
                const inner = (
                  <div
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-white/5",
                      !n.read_at && "bg-primary/5"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read_at ? "bg-transparent" : "bg-primary"
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          setOpen(false);
                          void markRead(n);
                        }}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => void markRead(n)}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-white/8 px-4 py-3">
          <PushOptIn />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export default NotificationBell;

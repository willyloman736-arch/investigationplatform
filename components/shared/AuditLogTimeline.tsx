import { formatDistanceToNow, parseISO, isValid } from "date-fns";
import { ScrollText, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";

/**
 * Append-only audit trail rendered as a vertical timeline. Shows the action,
 * the actor, a relative + absolute timestamp, and the reason when present.
 * This is presentation-only; the data comes from the audit_logs table.
 */
export interface AuditLogTimelineProps {
  items: AuditLog[];
  className?: string;
  /** Optional resolver to turn an actor_id into a display name. */
  resolveActor?: (actorId: string | null) => string | undefined;
}

/** Turn snake/camel action codes into a readable label, e.g. "Confirm Deposit". */
function humanizeAction(action: string): string {
  if (!action) return "Action";
  return action
    .replace(/[._-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = parseISO(iso);
  if (!isValid(d)) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

export function AuditLogTimeline({
  items,
  className,
  resolveActor,
}: AuditLogTimelineProps) {
  if (!items || items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center",
          className
        )}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
          <ScrollText className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            No audit activity yet
          </p>
          <p className="text-xs text-muted-foreground">
            Every important action on this case is recorded here for review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)} role="list">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const actorName =
          resolveActor?.(item.actor_id) ??
          (item.actor_id ? "Participant" : "System");
        const rel = relativeTime(item.created_at);

        return (
          <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Connector line */}
            {!isLast && (
              <span
                className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px bg-white/10"
                aria-hidden="true"
              />
            )}

            {/* Node */}
            <span
              className="relative z-10 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
              aria-hidden="true"
            >
              <span className="h-2 w-2 rounded-full bg-primary" />
            </span>

            {/* Body */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {humanizeAction(item.action)}
                </p>
                {item.entity_type && (
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.entity_type}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" aria-hidden="true" />
                  {actorName}
                </span>
                <span aria-hidden="true">·</span>
                <time
                  dateTime={item.created_at}
                  title={formatDateTime(item.created_at)}
                >
                  {rel ? `${rel} · ` : ""}
                  {formatDateTime(item.created_at)}
                </time>
              </div>

              {item.reason && (
                <p className="mt-2 rounded-lg border-l-2 border-primary/40 bg-white/[0.03] px-3 py-2 text-xs text-foreground/90">
                  <span className="font-medium text-muted-foreground">
                    Reason:{" "}
                  </span>
                  {item.reason}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default AuditLogTimeline;

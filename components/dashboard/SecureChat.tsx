"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SecureChat — per-case secure messaging surface (client component).
//
// Renders the message thread (sender, time, read receipt) and a composer that
// calls the `sendMessage` server action. Copy is deliberately honest: messages
// are "logged for dispute review" — we do NOT claim end-to-end encryption that
// is not implemented.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Send, ShieldCheck, Lock, Loader2, CheckCheck, Check } from "lucide-react";
import { toast } from "sonner";

import { cn, formatDateTime } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import { sendMessage } from "@/lib/actions/messages";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface SecureChatProps {
  caseId: string;
  messages: ChatMessage[];
  currentUserId: string;
  /** Optional display-name lookup by sender_id for nicer headers. */
  senderNames?: Record<string, string>;
  className?: string;
}

/** Build initials for an avatar fallback. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

let optimisticCounter = 0;

export function SecureChat({
  caseId,
  messages,
  currentUserId,
  senderNames,
  className,
}: SecureChatProps) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // Locally-sent messages shown instantly. When the server action revalidates
  // and the `messages` prop catches up, matching pending entries are dropped.
  // (We avoid React 19's useOptimistic to stay compatible with React 18.3.)
  const [pending, setPending] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (pending.length === 0) return;
    const known = new Set(
      messages.map((m) => `${m.sender_id}|${m.body}`)
    );
    setPending((prev) =>
      prev.filter((p) => !known.has(`${p.sender_id}|${p.body}`))
    );
    // Re-run whenever the authoritative server list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const allMessages = useMemo(
    () => [...messages, ...pending],
    [messages, pending]
  );

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;

    const optimistic: ChatMessage = {
      id: `optimistic-${optimisticCounter++}`,
      case_id: caseId,
      sender_id: currentUserId,
      body,
      read: false,
      created_at: new Date().toISOString(),
    };

    setPending((prev) => [...prev, optimistic]);
    setDraft("");

    startTransition(async () => {
      try {
        const result = await sendMessage({ caseId, body });
        if (result?.success === false) {
          toast.error(result.error ?? "Message could not be sent.");
          // Roll back the failed optimistic entry.
          setPending((prev) => prev.filter((p) => p.id !== optimistic.id));
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Message could not be sent."
        );
        setPending((prev) => prev.filter((p) => p.id !== optimistic.id));
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Secure Case Channel
            </p>
            <p className="text-[11px] text-muted-foreground">
              Communication is logged for dispute review.
            </p>
          </div>
        </div>
      </div>

      {/* Message list */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {allMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-muted-foreground">
                <Lock className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No messages yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Start the conversation. All messages are retained as part of the
                case record.
              </p>
            </div>
          ) : (
            allMessages.map((message) => {
              const mine = message.sender_id === currentUserId;
              const name =
                senderNames?.[message.sender_id] ??
                (mine ? "You" : "Counterparty");
              const isOptimistic = message.id.startsWith("optimistic-");
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-end gap-2",
                    mine ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-[10px] font-semibold",
                        mine
                          ? "bg-primary/20 text-primary"
                          : "bg-white/10 text-muted-foreground"
                      )}
                    >
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={cn(
                      "max-w-[78%] sm:max-w-[70%]",
                      mine ? "items-end text-right" : "items-start text-left"
                    )}
                  >
                    <div
                      className={cn(
                        "inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        mine
                          ? "rounded-br-sm bg-primary/15 text-foreground ring-1 ring-inset ring-primary/25"
                          : "rounded-bl-sm bg-white/5 text-foreground ring-1 ring-inset ring-white/10"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-1 text-[10px] text-muted-foreground",
                        mine ? "justify-end" : "justify-start"
                      )}
                    >
                      <span>{!mine && `${name} · `}</span>
                      <span>{formatDateTime(message.created_at)}</span>
                      {mine &&
                        (isOptimistic ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : message.read ? (
                          <CheckCheck className="h-3 w-3 text-primary" />
                        ) : (
                          <Check className="h-3 w-3" />
                        ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-white/5"
            rows={1}
            aria-label="Message"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={isPending || draft.trim().length === 0}
            aria-label="Send message"
            className="h-11 w-11 shrink-0"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Messages are retained as part of the case record and may be reviewed by
          an administrator during a dispute.
        </p>
      </div>
    </div>
  );
}

export default SecureChat;

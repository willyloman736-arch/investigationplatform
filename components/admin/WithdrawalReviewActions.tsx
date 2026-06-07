"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { reviewWithdrawalProcessingRequest } from "@/lib/actions/withdrawals";
import type { WithdrawalFeeStatus, WithdrawalStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WithdrawalReviewActionsProps {
  withdrawalId: string;
  status?: WithdrawalStatus;
  feeStatus?: WithdrawalFeeStatus;
  disabled?: boolean;
}

type ReviewAction =
  | "approve"
  | "verify_fee"
  | "mark_processing"
  | "mark_completed"
  | "reject"
  | "needs_more_information";

export function WithdrawalReviewActions({
  withdrawalId,
  status,
  feeStatus,
  disabled = false,
}: WithdrawalReviewActionsProps) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<ReviewAction | null>(null);
  const feeCompleted = feeStatus === "completed";

  function run(action: ReviewAction) {
    if ((action === "reject" || action === "needs_more_information") && !note.trim()) {
      toast.error("Add a reason note before sending this decision.");
      return;
    }

    setBusy(action);
    React.startTransition(async () => {
      const result = await reviewWithdrawalProcessingRequest({
        withdrawalId,
        action,
        note,
      });
      setBusy(null);

      if (!result.success) {
        toast.error(result.error ?? "Could not update withdrawal request.");
        return;
      }

      toast.success("Withdrawal review updated.");
      router.refresh();
    });
  }

  const actions: Array<{
    action: ReviewAction;
    label: string;
    icon: LucideIcon;
    variant?: React.ComponentProps<typeof Button>["variant"];
    disabled?: boolean;
  }> = [
    {
      action: "approve",
      label: "Approve Review",
      icon: CheckCircle2,
      disabled,
    },
    {
      action: "verify_fee",
      label: "Verify Fee",
      icon: ShieldCheck,
      disabled: disabled || feeCompleted,
    },
    {
      action: "mark_processing",
      label: "Processing",
      icon: PlayCircle,
      disabled: disabled || !feeCompleted || status === "processing",
    },
    {
      action: "mark_completed",
      label: "Completed",
      icon: BadgeCheck,
      disabled: disabled || !feeCompleted || status === "completed",
    },
    {
      action: "needs_more_information",
      label: "Need Info",
      icon: RotateCcw,
      variant: "outline",
      disabled,
    },
    {
      action: "reject",
      label: "Reject",
      icon: XCircle,
      variant: "destructive",
      disabled,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3">
      <Label htmlFor={`withdrawal-note-${withdrawalId}`}>Review note</Label>
      <Textarea
        id={`withdrawal-note-${withdrawalId}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Approval basis, rejection reason, or information needed."
        className="mt-2 min-h-[88px] rounded-xl border-white/10 bg-background/40"
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((item) => {
          const Icon = item.icon;
          const active = busy === item.action;
          return (
            <Button
              key={item.action}
              type="button"
              variant={item.variant}
              onClick={() => run(item.action)}
              disabled={item.disabled || Boolean(busy)}
              className="h-11 rounded-xl"
            >
              {active ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
              {item.label}
            </Button>
          );
        })}
      </div>
      {!feeCompleted ? (
        <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-xs leading-relaxed text-amber-100">
          Processing can begin after release processing fee completion has been verified.
        </p>
      ) : null}
    </div>
  );
}

export default WithdrawalReviewActions;

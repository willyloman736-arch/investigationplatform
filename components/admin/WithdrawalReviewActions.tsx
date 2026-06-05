"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { reviewWithdrawalProcessingRequest } from "@/lib/actions/withdrawals";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WithdrawalReviewActionsProps {
  withdrawalId: string;
  disabled?: boolean;
}

type ReviewAction = "approve" | "reject" | "needs_more_information";

export function WithdrawalReviewActions({
  withdrawalId,
  disabled = false,
}: WithdrawalReviewActionsProps) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<ReviewAction | null>(null);

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
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          onClick={() => run("approve")}
          disabled={disabled || Boolean(busy)}
          className="h-11 rounded-xl"
        >
          {busy === "approve" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => run("needs_more_information")}
          disabled={disabled || Boolean(busy)}
          className="h-11 rounded-xl"
        >
          {busy === "needs_more_information" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )}
          Need Info
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => run("reject")}
          disabled={disabled || Boolean(busy)}
          className="h-11 rounded-xl"
        >
          {busy === "reject" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          )}
          Reject
        </Button>
      </div>
    </div>
  );
}

export default WithdrawalReviewActions;

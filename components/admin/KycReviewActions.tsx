"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { reviewKycSubmission } from "@/lib/actions/kyc";
import type { KycStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface KycReviewActionsProps {
  submissionId: string;
  currentStatus: KycStatus;
}

export function KycReviewActions({
  submissionId,
  currentStatus,
}: KycReviewActionsProps) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<KycStatus | null>(null);

  const alreadyClosed =
    currentStatus === "verified" || currentStatus === "declined";

  function run(status: Extract<KycStatus, "verified" | "declined" | "resubmission_required">) {
    if ((status === "declined" || status === "resubmission_required") && !note.trim()) {
      toast.error("Add a review note before declining or requesting resubmission.");
      return;
    }

    setBusy(status);
    React.startTransition(async () => {
      const result = await reviewKycSubmission({
        submissionId,
        status,
        note,
      });
      setBusy(null);

      if (!result.success) {
        toast.error(result.error ?? "Could not update KYC review.");
        return;
      }

      toast.success("KYC review updated.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Review decision
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Verification outcome
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Approvals sync the client profile to verified. Declines and
          resubmissions require a note and keep transfer eligibility locked.
        </p>
      </div>

      <div className="mt-4">
        <Label htmlFor="kyc-review-note">Review note</Label>
        <Textarea
          id="kyc-review-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Summarize document findings, missing items, or approval basis."
          className="mt-2 min-h-[110px] rounded-xl border-white/10 bg-background/40"
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          onClick={() => run("verified")}
          disabled={Boolean(busy) || alreadyClosed}
          className="h-11 rounded-xl"
        >
          {busy === "verified" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => run("resubmission_required")}
          disabled={Boolean(busy) || currentStatus === "verified"}
          className="h-11 rounded-xl"
        >
          {busy === "resubmission_required" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )}
          Resubmit
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => run("declined")}
          disabled={Boolean(busy) || alreadyClosed}
          className="h-11 rounded-xl"
        >
          {busy === "declined" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          )}
          Decline
        </Button>
      </div>
    </section>
  );
}

export default KycReviewActions;

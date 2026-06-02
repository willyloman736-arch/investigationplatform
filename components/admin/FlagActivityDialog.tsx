"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FlagActivityDialog — admin flags suspicious activity on a case.
//
// Requires a non-empty reason before calling the `flagActivity` server action.
// Flagging is a review/audit action — it does NOT move funds or change escrow
// status on its own.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useState, useTransition } from "react";
import { Flag, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { flagActivity } from "@/lib/actions/admin";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface FlagActivityDialogProps {
  caseId: string;
  children?: React.ReactNode;
}

export function FlagActivityDialog({
  caseId,
  children,
}: FlagActivityDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("A reason is required to flag activity.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await flagActivity({ caseId, reason: trimmed });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not flag this case.");
        } else {
          toast.success("Activity flagged and recorded in the audit log.");
          setReason("");
          setOpen(false);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not flag this case."
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Flag className="h-4 w-4" />
            Flag activity
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Flag suspicious activity
          </DialogTitle>
          <DialogDescription>
            Record a concern about this case for review. Flagging is logged for
            audit and does not move funds or change escrow status by itself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <Label htmlFor="flag-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="flag-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what looks suspicious (e.g. mismatched receipts, identity concerns, unusual deposit pattern)."
            className="min-h-[110px]"
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isPending || reason.trim().length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Flagging…
              </>
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Flag activity
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FlagActivityDialog;

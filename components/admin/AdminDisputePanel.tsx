"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AdminDisputePanel — open / review / resolve disputes (client component).
//
// Renders dispute detail and resolution controls. Resolving requires choosing an
// outcome (resolved_release / resolved_refund / rejected) AND a non-empty reason
// note, then calls `resolveDispute`. When no dispute exists for a case, the panel
// offers to open one via `openDispute` (reason required).
//
// Resolving to "release" only marks the escrow eligible — the actual release is
// still triggered server-side via the protected route. This panel never moves
// funds.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Gavel,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Undo2,
  XCircle,
  Plus,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { cn, formatDateTime } from "@/lib/utils";
import type { Dispute, DisputeStatus } from "@/lib/types";
import { resolveDispute, openDispute } from "@/lib/actions/admin";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Resolution outcomes an admin can apply to an open dispute. */
type Resolution = Extract<
  DisputeStatus,
  "resolved_release" | "resolved_refund" | "rejected"
>;

const DISPUTE_STATUS_META: Record<
  DisputeStatus,
  { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "info" }
> = {
  open: { label: "Open", variant: "warning" },
  under_review: { label: "Under Review", variant: "info" },
  resolved_release: { label: "Resolved — Release", variant: "success" },
  resolved_refund: { label: "Resolved — Refund", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const RESOLUTION_OPTIONS: {
  value: Resolution;
  label: string;
  icon: typeof CheckCircle2;
  hint: string;
}[] = [
  {
    value: "resolved_release",
    label: "Resolve → Release",
    icon: CheckCircle2,
    hint: "Funds become eligible for release to Party B. Release still runs server-side after provider confirmation.",
  },
  {
    value: "resolved_refund",
    label: "Resolve → Refund",
    icon: Undo2,
    hint: "Outcome favors a refund to the depositor, handled by the licensed provider.",
  },
  {
    value: "rejected",
    label: "Reject dispute",
    icon: XCircle,
    hint: "The dispute is rejected; the escrow returns to its prior state.",
  },
];

/**
 * Map the UI outcome (DB dispute-status enum, used for labels/badges) to the
 * short code the resolveDispute server action validates against.
 */
const RESOLUTION_TO_ACTION: Record<Resolution, "release" | "refund" | "reject"> = {
  resolved_release: "release",
  resolved_refund: "refund",
  rejected: "reject",
};

export interface AdminDisputePanelProps {
  /** The dispute to review. Omit (with caseId) to offer opening a new one. */
  dispute?: Dispute | null;
  /** Required when no dispute is present so a new one can be opened. */
  caseId?: string;
  /** Optional case number for display context. */
  caseNumber?: string;
  className?: string;
}

export function AdminDisputePanel({
  dispute,
  caseId,
  caseNumber,
  className,
}: AdminDisputePanelProps) {
  const router = useRouter();

  // Resolve dialog state.
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [resolveReason, setResolveReason] = useState("");
  const [isResolving, startResolve] = useTransition();

  // Open-dispute dialog state.
  const [openDialog, setOpenDialog] = useState(false);
  const [openReason, setOpenReason] = useState("");
  const [isOpening, startOpen] = useTransition();

  const targetCaseId = dispute?.case_id ?? caseId;
  const isResolved =
    dispute != null &&
    dispute.status !== "open" &&
    dispute.status !== "under_review";

  function handleResolve() {
    if (!dispute) return;
    if (!resolution) {
      toast.error("Choose a resolution outcome.");
      return;
    }
    const trimmed = resolveReason.trim();
    if (!trimmed) {
      toast.error("A resolution note is required.");
      return;
    }
    const chosen = resolution;
    startResolve(async () => {
      try {
        const result = await resolveDispute({
          disputeId: dispute.id,
          resolution: RESOLUTION_TO_ACTION[chosen],
          reason: trimmed,
        });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not resolve the dispute.");
        } else {
          toast.success("Dispute resolved and recorded in the audit log.");
          setResolveOpen(false);
          setResolution(null);
          setResolveReason("");
          router.refresh();
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not resolve the dispute."
        );
      }
    });
  }

  function handleOpen() {
    if (!targetCaseId) return;
    const trimmed = openReason.trim();
    if (!trimmed) {
      toast.error("A reason is required to open a dispute.");
      return;
    }
    startOpen(async () => {
      try {
        const result = await openDispute({
          caseId: targetCaseId,
          reason: trimmed,
        });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not open the dispute.");
        } else {
          toast.success("Dispute opened. The case is now under audit.");
          setOpenDialog(false);
          setOpenReason("");
          router.refresh();
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not open the dispute."
        );
      }
    });
  }

  // ── Empty state: no dispute, offer to open one ─────────────────────────────
  if (!dispute) {
    return (
      <>
        <div
          className={cn(
            "rounded-2xl border border-white/10 bg-card/60 p-6 text-center backdrop-blur-md",
            className
          )}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-muted-foreground">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">
            No active dispute
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            This case has no open dispute. If a concern arises, open one to place
            the escrow under audit and block release.
          </p>
          {targetCaseId && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setOpenDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Open a dispute
            </Button>
          )}
        </div>

        <Dialog open={openDialog} onOpenChange={(o) => !o && setOpenDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                Open a dispute
              </DialogTitle>
              <DialogDescription>
                Opening a dispute places the escrow under audit and blocks release
                until it is resolved. This is recorded in the audit log.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 py-1">
              <Label htmlFor="open-dispute-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="open-dispute-reason"
                value={openReason}
                onChange={(e) => setOpenReason(e.target.value)}
                placeholder="Describe the dispute (e.g. deliverables contested, evidence inconsistent)."
                className="min-h-[110px]"
              />
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpenDialog(false)}
                disabled={isOpening}
              >
                Cancel
              </Button>
              <Button
                onClick={handleOpen}
                disabled={isOpening || openReason.trim().length === 0}
              >
                {isOpening ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening…
                  </>
                ) : (
                  "Open dispute"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── Dispute present: review + resolve ──────────────────────────────────────
  const statusMeta = DISPUTE_STATUS_META[dispute.status];

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-md sm:p-6",
          className
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Dispute Review
              </h3>
              <p className="text-xs text-muted-foreground">
                {caseNumber ? `${caseNumber} · ` : ""}
                Opened {formatDateTime(dispute.created_at)}
              </p>
            </div>
          </div>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Reason
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {dispute.reason}
          </p>
        </div>

        {isResolved ? (
          <Alert variant="success" className="mt-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Resolved</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>
                Outcome:{" "}
                <span className="font-medium text-foreground">
                  {statusMeta.label}
                </span>
                {dispute.resolved_at &&
                  ` · ${formatDateTime(dispute.resolved_at)}`}
              </p>
              {dispute.resolution_note && (
                <p className="text-muted-foreground">
                  “{dispute.resolution_note}”
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => setResolveOpen(true)}>
              <Gavel className="h-4 w-4" />
              Resolve dispute
            </Button>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Release stays blocked while this dispute is open.
            </span>
          </div>
        )}
      </div>

      {/* Resolve dialog */}
      <Dialog
        open={resolveOpen}
        onOpenChange={(o) => !o && !isResolving && setResolveOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" />
              Resolve dispute
            </DialogTitle>
            <DialogDescription>
              Choose an outcome and record the rationale. Resolving to release
              only marks the escrow eligible — funds release server-side after the
              provider confirms.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>
                Outcome <span className="text-destructive">*</span>
              </Label>
              <div className="grid gap-2">
                {RESOLUTION_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = resolution === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setResolution(opt.value)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary/50 bg-primary/10"
                          : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
                      )}
                      aria-pressed={selected}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          selected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {opt.label}
                        </span>
                        <span className="block text-[11px] leading-relaxed text-muted-foreground">
                          {opt.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resolve-reason">
                Resolution note <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="resolve-reason"
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                placeholder="Explain the basis for this resolution (evidence reviewed, rationale)."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setResolveOpen(false)}
              disabled={isResolving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={
                isResolving ||
                resolution === null ||
                resolveReason.trim().length === 0
              }
            >
              {isResolving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving…
                </>
              ) : (
                "Confirm resolution"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AdminDisputePanel;

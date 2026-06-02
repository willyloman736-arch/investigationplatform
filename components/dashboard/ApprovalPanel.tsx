"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ApprovalPanel — dual-party release approval surface (client component).
//
// Shows a card for Party A and Party B. The signed-in party can submit THEIR
// approval via the `submitApproval` server action. Release requires BOTH parties
// approved (or an admin dispute resolution), then an admin review. This panel
// NEVER changes escrow status or triggers release; release runs server-side only.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ShieldCheck,
  Info,
  UserCheck,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Approval, EscrowStatus, PartyRole } from "@/lib/types";
import { submitApproval } from "@/lib/actions/approvals";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";

export interface ApprovalPanelProps {
  caseId: string;
  approvals: Approval[];
  escrowStatus: EscrowStatus;
  /** The party role the signed-in user holds on this case (null = observer/admin). */
  currentParty: PartyRole | null;
  className?: string;
}

const PARTY_LABELS: Record<"party_a" | "party_b", string> = {
  party_a: "Party A",
  party_b: "Party B",
};

export function ApprovalPanel({
  caseId,
  approvals,
  escrowStatus,
  currentParty,
  className,
}: ApprovalPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState<PartyRole | null>(null);

  const approvalFor = (role: PartyRole): Approval | undefined =>
    approvals.find((a) => a.party_role === role);

  const partyAApproved = Boolean(approvalFor("party_a")?.approved);
  const partyBApproved = Boolean(approvalFor("party_b")?.approved);
  const bothApproved = partyAApproved && partyBApproved;

  const isReady = escrowStatus === "ready_for_release";
  const isReleased = escrowStatus === "released";
  const isBlocked =
    escrowStatus === "under_dispute_audit" ||
    escrowStatus === "release_frozen";
  // Approvals only make sense once funds are actually held in escrow.
  const canApproveStage = escrowStatus === "securely_escrowed" || isReady;

  function handleApprove(role: PartyRole) {
    if (role !== "party_a" && role !== "party_b") return;
    setSubmitting(role);
    startTransition(async () => {
      try {
        const result = await submitApproval({ caseId, partyRole: role });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not record your approval.");
        } else {
          toast.success(
            "Your approval has been recorded. An admin must review the escrow before release is requested."
          );
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not record your approval."
        );
      } finally {
        setSubmitting(null);
      }
    });
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Headline rule */}
      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Funds are released only after both parties approve
          </span>{" "}
          — or after an administrator resolves a dispute in favor of release.
          Approving here records your consent; admins still control escrow
          workflow status and provider release requests.
        </p>
      </div>

      {/* Party cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["party_a", "party_b"] as const).map((role) => {
          const approval = approvalFor(role);
          const approved = Boolean(approval?.approved);
          const isYou = currentParty === role;
          const busy = isPending && submitting === role;

          return (
            <div
              key={role}
              className={cn(
                "rounded-2xl border bg-card/60 p-4 backdrop-blur-md transition-colors",
                approved
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border-white/10"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      approved
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/5 text-muted-foreground"
                    )}
                  >
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {PARTY_LABELS[role]}
                      {isYou && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          You
                        </span>
                      )}
                    </p>
                    <p
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        approved
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {approved ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Approved release
                        </>
                      ) : (
                        <>
                          <Circle className="h-3 w-3" />
                          Awaiting approval
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {approval?.note && (
                <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                  “{approval.note}”
                </p>
              )}

              {/* Action: only the signed-in party may approve their own side. */}
              {isYou && !approved && (
                <div className="mt-4">
                  <Button
                    onClick={() => handleApprove(role)}
                    disabled={isPending || !canApproveStage || isBlocked}
                    className="w-full"
                    size="sm"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recording…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve release as {PARTY_LABELS[role]}
                      </>
                    )}
                  </Button>
                  {!canApproveStage && !isBlocked && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Approval opens once the deposit is confirmed and funds are
                      securely escrowed.
                    </p>
                  )}
                </div>
              )}

              {isYou && approved && (
                <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  You approved release for this case.
                </p>
              )}

              {!isYou && (
                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Only {PARTY_LABELS[role]} can submit this approval.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Combined status */}
      {isReleased ? (
        <Alert variant="success">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Funds released</AlertTitle>
          <AlertDescription>
            The licensed escrow partner has confirmed the release for this case.
          </AlertDescription>
        </Alert>
      ) : isBlocked ? (
        <Alert variant="warning">
          <Info className="h-4 w-4" />
          <AlertTitle>Approvals paused</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            Release is currently blocked.
            <EscrowStatusBadge status={escrowStatus} />
            An administrator must clear this before approvals can proceed.
          </AlertDescription>
        </Alert>
      ) : isReady || bothApproved ? (
        <Alert variant="info">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Both parties approved — awaiting admin review</AlertTitle>
          <AlertDescription>
            This case has the consent needed for release. An administrator must
            review the case, record the reason note, and submit the provider
            release request from the admin portal. No funds move from this
            screen.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>
            Waiting on{" "}
            {!partyAApproved && !partyBApproved
              ? "both parties"
              : !partyAApproved
                ? "Party A"
                : "Party B"}
          </AlertTitle>
          <AlertDescription>
            Release becomes available only when{" "}
            <span className="font-medium text-foreground">
              both Party A and Party B
            </span>{" "}
            have approved.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default ApprovalPanel;

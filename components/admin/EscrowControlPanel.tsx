"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EscrowControlPanel — admin escrow command surface (client component).
//
// One button per permitted admin action. EVERY status-changing action opens a
// confirmation dialog that REQUIRES a non-empty reason note before the matching
// server action runs. Confirm-deposit additionally captures a provider reference
// (it only REFLECTS a provider/webhook event — it never moves money). Request
// additional verification captures which party.
//
// "Trigger Secure Release Request" POSTs to /api/escrow/release — the ONLY place
// a release is initiated, server-side, after re-checking eligibility. No release
// logic lives in this component.
//
// Hard rule surfaced to the operator: an admin can NEVER move funds from the UI.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Clock,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Snowflake,
  FileSearch,
  BadgeCheck,
  Banknote,
  Loader2,
  ShieldCheck,
  Info,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn, formatCurrency } from "@/lib/utils";
import {
  DEPOSIT_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
} from "@/lib/constants";
import type {
  Case,
  EscrowContract,
  EscrowStatus,
  PartyRole,
} from "@/lib/types";
import {
  adminSetEscrowStatus,
  confirmDeposit,
  freezeRelease,
  requestAdditionalVerification,
  approveReleaseEligibility,
} from "@/lib/actions/escrow";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EscrowControlPanelProps {
  /** Renamed from the reserved word `case` for safe destructuring. */
  case: Case;
  escrow: EscrowContract | null;
  className?: string;
}

/** Identifies which action a dialog will perform on confirm. */
type ActionKey =
  | "mark_pending"
  | "confirm_deposit"
  | "mark_escrowed"
  | "under_dispute_audit"
  | "freeze_release"
  | "request_verification"
  | "approve_eligibility"
  | "trigger_release";

interface ActionDef {
  key: ActionKey;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Dialog confirm button label. */
  confirmLabel: string;
  /** Visual emphasis for the trigger button. */
  tone: "default" | "outline" | "destructive" | "primary";
  /** Whether this action needs a provider reference field. */
  needsProviderRef?: boolean;
  /** Whether this action needs a party selector. */
  needsParty?: boolean;
  /** Whether this is the special release route call. */
  isRelease?: boolean;
}

const ACTIONS: ActionDef[] = [
  {
    key: "mark_pending",
    label: "Mark pending deposit",
    icon: Clock,
    description:
      "Set this escrow back to awaiting the funding deposit. Use if a deposit needs to be re-initiated.",
    confirmLabel: "Mark pending deposit",
    tone: "outline",
  },
  {
    key: "confirm_deposit",
    label: "Confirm deposit",
    icon: CheckCircle2,
    description:
      "Record that the licensed provider has confirmed the deposit. This only REFLECTS a provider/webhook event — it does not move money. Enter the provider reference.",
    confirmLabel: "Record confirmed deposit",
    tone: "default",
    needsProviderRef: true,
  },
  {
    key: "mark_escrowed",
    label: "Mark securely escrowed",
    icon: Lock,
    description:
      "Mark the funds as confirmed held by the escrow partner and locked pending approvals.",
    confirmLabel: "Mark securely escrowed",
    tone: "default",
  },
  {
    key: "under_dispute_audit",
    label: "Place under dispute audit",
    icon: ShieldAlert,
    description:
      "Block release while a dispute is reviewed. Parties will see the case is under audit.",
    confirmLabel: "Place under dispute audit",
    tone: "destructive",
  },
  {
    key: "freeze_release",
    label: "Freeze release",
    icon: Snowflake,
    description:
      "Freeze any release pending additional verification. No funds can move while frozen.",
    confirmLabel: "Freeze release",
    tone: "outline",
  },
  {
    key: "request_verification",
    label: "Request additional verification",
    icon: FileSearch,
    description:
      "Ask a party for more verification before release can proceed. Choose which party and explain what is needed.",
    confirmLabel: "Request verification",
    tone: "outline",
    needsParty: true,
  },
  {
    key: "approve_eligibility",
    label: "Approve release eligibility",
    icon: BadgeCheck,
    description:
      "Mark this escrow as eligible for release (e.g. after a dispute resolved to release). This sets it READY FOR RELEASE — it does NOT release funds.",
    confirmLabel: "Approve eligibility",
    tone: "primary",
  },
  {
    key: "trigger_release",
    label: "Trigger secure release request",
    icon: Banknote,
    description:
      "Submit the release request to the licensed provider. This runs server-side, re-checks eligibility, and only completes when the provider confirms. You are NOT moving funds yourself.",
    confirmLabel: "Submit release request",
    tone: "primary",
    isRelease: true,
  },
];

function triggerButtonClass(tone: ActionDef["tone"]): {
  variant: "default" | "outline" | "destructive" | "secondary" | "ghost";
  className?: string;
} {
  switch (tone) {
    case "primary":
      return { variant: "default" };
    case "destructive":
      return { variant: "destructive" };
    case "outline":
      return { variant: "outline" };
    default:
      return { variant: "secondary" };
  }
}

export function EscrowControlPanel({
  case: caseRow,
  escrow,
  className,
}: EscrowControlPanelProps) {
  const router = useRouter();
  const [active, setActive] = useState<ActionDef | null>(null);
  const [reason, setReason] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [party, setParty] =
    useState<Extract<PartyRole, "party_a" | "party_b">>("party_a");
  const [isPending, startTransition] = useTransition();

  const caseId = caseRow.id;
  const currency = escrow?.currency ?? "USD";

  function openAction(def: ActionDef) {
    setActive(def);
    setReason("");
    setProviderRef(def.needsProviderRef ? escrow?.provider_reference ?? "" : "");
    setParty("party_a");
  }

  function closeDialog() {
    if (isPending) return;
    setActive(null);
  }

  async function runAction(def: ActionDef): Promise<void> {
    const trimmedReason = reason.trim();

    // Reason is mandatory for every status-changing action.
    if (!trimmedReason) {
      toast.error("A reason note is required for this action.");
      return;
    }
    if (def.needsProviderRef && !providerRef.trim()) {
      toast.error("A provider reference is required to confirm a deposit.");
      return;
    }

    try {
      // The release path is special: it POSTs to the protected server route.
      if (def.isRelease) {
        const res = await fetch("/api/escrow/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, reason: trimmedReason }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload?.success === false) {
          toast.error(
            payload?.error ??
              "Release request was rejected. Eligibility re-check may have failed."
          );
          return;
        }
        toast.success(
          "Release request submitted to the provider. Funds release only after the provider confirms."
        );
        setActive(null);
        router.refresh();
        return;
      }

      // Otherwise call the matching server action.
      let result: { success: boolean; error?: string } | undefined;
      switch (def.key) {
        case "mark_pending":
          result = await adminSetEscrowStatus({
            caseId,
            status: "pending_deposit",
            reason: trimmedReason,
          });
          break;
        case "mark_escrowed":
          result = await adminSetEscrowStatus({
            caseId,
            status: "securely_escrowed",
            reason: trimmedReason,
          });
          break;
        case "under_dispute_audit":
          result = await adminSetEscrowStatus({
            caseId,
            status: "under_dispute_audit",
            reason: trimmedReason,
          });
          break;
        case "confirm_deposit":
          result = await confirmDeposit({
            caseId,
            providerReference: providerRef.trim(),
          });
          break;
        case "freeze_release":
          result = await freezeRelease({ caseId, reason: trimmedReason });
          break;
        case "request_verification":
          result = await requestAdditionalVerification({
            caseId,
            party,
            reason: trimmedReason,
          });
          break;
        case "approve_eligibility":
          result = await approveReleaseEligibility({
            caseId,
            reason: trimmedReason,
          });
          break;
      }

      if (result?.success === false) {
        toast.error(result.error ?? "The action could not be completed.");
        return;
      }
      toast.success("Action recorded and logged to the case audit.");
      setActive(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The action could not be completed."
      );
    }
  }

  const ActiveIcon = active?.icon ?? null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-md sm:p-6",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Escrow Controls
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Administer escrow state for {caseRow.case_number}. Every change
            requires a reason and is audited.
          </p>
        </div>
        {escrow && <EscrowStatusBadge status={escrow.escrow_status} />}
      </div>

      {/* Hard compliance notice */}
      <Alert className="mt-4 border-primary/30 bg-primary/[0.06]">
        <Lock className="h-4 w-4" />
        <AlertTitle className="text-foreground">
          Admin cannot move funds directly
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Release executes server-side only after the licensed provider confirms
          eligibility. These controls change status and request actions — they do
          not transfer money.
        </AlertDescription>
      </Alert>

      {/* Current snapshot */}
      {escrow ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Snapshot label="Total held" value={formatCurrency(escrow.total_amount, currency)} />
          <Snapshot
            label="Net release"
            value={formatCurrency(escrow.net_release_amount, currency)}
            accent
          />
          <Snapshot
            label="Deposit"
            value={DEPOSIT_STATUS_LABELS[escrow.deposit_status]}
          />
          <Snapshot
            label="Release"
            value={RELEASE_STATUS_LABELS[escrow.release_status]}
          />
        </div>
      ) : (
        <Alert variant="warning" className="mt-4">
          <Info className="h-4 w-4" />
          <AlertTitle>No escrow contract</AlertTitle>
          <AlertDescription>
            This case has no escrow contract yet, so escrow controls are
            unavailable.
          </AlertDescription>
        </Alert>
      )}

      <Separator className="my-5 bg-white/10" />

      {/* Action buttons */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ACTIONS.map((def) => {
          const { variant } = triggerButtonClass(def.tone);
          const Icon = def.icon;
          return (
            <Button
              key={def.key}
              variant={variant}
              className={cn(
                "h-auto w-full justify-start gap-3 px-3 py-2.5 text-left",
                def.isRelease &&
                  "ring-1 ring-inset ring-primary/40"
              )}
              onClick={() => openAction(def)}
              disabled={!escrow}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  {def.label}
                </span>
              </span>
            </Button>
          );
        })}
      </div>

      {/* Reason-gated confirmation dialog */}
      <Dialog open={active !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {ActiveIcon && <ActiveIcon className="h-4 w-4 text-primary" />}
              {active?.label}
            </DialogTitle>
            <DialogDescription>{active?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {active?.isRelease && (
              <Alert className="border-primary/30 bg-primary/[0.06]">
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription className="text-muted-foreground">
                  This submits a request to the provider via a protected server
                  route. The provider — not this app — performs any transfer, and
                  only after confirming eligibility.
                </AlertDescription>
              </Alert>
            )}

            {active?.needsParty && (
              <div className="space-y-1.5">
                <Label htmlFor="escrow-party">Party</Label>
                <Select
                  value={party}
                  onValueChange={(v) =>
                    setParty(v as Extract<PartyRole, "party_a" | "party_b">)
                  }
                >
                  <SelectTrigger id="escrow-party">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="party_a">Party A</SelectItem>
                    <SelectItem value="party_b">Party B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {active?.needsProviderRef && (
              <div className="space-y-1.5">
                <Label htmlFor="provider-ref">
                  Provider reference{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="provider-ref"
                  value={providerRef}
                  onChange={(e) => setProviderRef(e.target.value)}
                  placeholder="e.g. ESCROW-REF-2026-00123"
                />
                <p className="text-[11px] text-muted-foreground">
                  The confirmation reference returned by the licensed provider or
                  webhook.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="escrow-reason">
                Reason note <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="escrow-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you are taking this action. This is recorded in the audit log."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant={active?.tone === "destructive" ? "destructive" : "default"}
              disabled={
                isPending ||
                reason.trim().length === 0 ||
                (active?.needsProviderRef === true &&
                  providerRef.trim().length === 0)
              }
              onClick={() => {
                if (!active) return;
                startTransition(() => {
                  void runAction(active);
                });
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Working…
                </>
              ) : (
                active?.confirmLabel
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Snapshot({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold",
          accent ? "text-emerald-400" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default EscrowControlPanel;

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CreditCard, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { requestEscrowWithdrawal } from "@/lib/actions/client-operations";
import {
  KYC_STATUS_LABELS,
  PAYOUT_METHOD_LABELS,
  RELEASE_STATUS_LABELS,
  SUPPORTED_PAYOUT_METHODS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import type { KycStatus, PayoutMethod, ReleaseStatus, WithdrawalStatus } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface WithdrawalRequestDialogProps {
  caseId: string;
  availableAmount: number;
  currency: string;
  kycStatus: KycStatus;
  releaseStatus: ReleaseStatus;
  openConditions: number;
  existingStatus: WithdrawalStatus;
  className?: string;
  fullWidth?: boolean;
}

export function WithdrawalRequestDialog({
  caseId,
  availableAmount,
  currency,
  kycStatus,
  releaseStatus,
  openConditions,
  existingStatus,
  className,
  fullWidth = false,
}: WithdrawalRequestDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(
    availableAmount > 0 ? String(availableAmount) : ""
  );
  const [method, setMethod] = React.useState<PayoutMethod>("bank_transfer");
  const [destinationLabel, setDestinationLabel] = React.useState("");
  const [note, setNote] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (availableAmount > 0) setAmount(String(availableAmount));
  }, [availableAmount]);

  const hasActiveRequest = [
    "requested",
    "conditions_required",
    "approved",
  ].includes(existingStatus);
  const blockers = [
    {
      label: "KYC verification",
      complete: kycStatus === "verified",
      value: KYC_STATUS_LABELS[kycStatus],
    },
    {
      label: "Release authorization",
      complete: releaseStatus === "eligible",
      value: RELEASE_STATUS_LABELS[releaseStatus],
    },
    {
      label: "Release conditions",
      complete: openConditions === 0,
      value:
        openConditions === 0
          ? "No open conditions"
          : `${openConditions} open condition${openConditions === 1 ? "" : "s"}`,
    },
    {
      label: "Available balance",
      complete: availableAmount > 0,
      value: formatCurrency(availableAmount, currency),
    },
    {
      label: "Transfer request",
      complete: !hasActiveRequest,
      value: WITHDRAWAL_STATUS_LABELS[existingStatus],
    },
  ];
  const ready = blockers.every((item) => item.complete);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await requestEscrowWithdrawal({
        caseId,
        amount: Number(amount),
        currency,
        method,
        destinationLabel,
        note,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not request transfer.");
        return;
      }

      toast.success("Transfer request submitted.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            "h-11 rounded-xl shadow-2xl shadow-primary/20",
            fullWidth && "w-full",
            className
          )}
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          Withdraw / Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request escrow transfer</DialogTitle>
          <DialogDescription>
            Submit a transfer request for eligible escrow funds. This does not
            move money from the browser; it creates a protected backend request
            for review and provider processing.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Eligible balance
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency(availableAmount, currency)}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset",
                ready
                  ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25"
                  : "bg-amber-400/15 text-amber-200 ring-amber-400/25"
              )}
            >
              {ready ? (
                <Send className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Lock className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
          </div>
        </div>

        {!ready ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Transfer requirements
            </p>
            <div className="grid gap-2">
              {blockers.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      item.complete ? "bg-emerald-300" : "bg-amber-300"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.value}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            {kycStatus !== "verified" ? (
              <Button asChild className="w-full">
                <Link href="/dashboard/profile">
                  Complete KYC
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="transfer-amount">Amount</Label>
                <Input
                  id="transfer-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
                  required
                />
              </div>
              <div>
                <Label>Transfer method</Label>
                <Select
                  value={method}
                  onValueChange={(value) => setMethod(value as PayoutMethod)}
                >
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-background/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_PAYOUT_METHODS.map((item) => (
                      <SelectItem key={item.method} value={item.method}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="transfer-destination">
                {PAYOUT_METHOD_LABELS[method]} destination
              </Label>
              <Input
                id="transfer-destination"
                value={destinationLabel}
                onChange={(event) => setDestinationLabel(event.target.value)}
                placeholder="Bank account label, card ending, or PayPal email"
                className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
                required
              />
            </div>
            <div>
              <Label htmlFor="transfer-note">Transfer note</Label>
              <Textarea
                id="transfer-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional transfer instructions"
                className="mt-2 min-h-[86px] rounded-xl border-white/10 bg-background/40"
              />
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-xl shadow-2xl shadow-primary/20"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Submit transfer request
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default WithdrawalRequestDialog;

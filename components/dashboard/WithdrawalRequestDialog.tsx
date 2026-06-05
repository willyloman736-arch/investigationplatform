"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, Lock } from "lucide-react";

import {
  KYC_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import type { KycStatus, ReleaseStatus, WithdrawalStatus } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const href =
    kycStatus === "verified"
      ? `/dashboard/withdraw?caseId=${encodeURIComponent(caseId)}`
      : "/dashboard/kyc";
  const locked = kycStatus !== "verified" || availableAmount <= 0;
  const helper =
    kycStatus !== "verified"
      ? `KYC required: ${KYC_STATUS_LABELS[kycStatus]}`
      : openConditions > 0
      ? `${openConditions} release condition${openConditions === 1 ? "" : "s"} pending`
      : releaseStatus !== "eligible"
      ? `Release status: ${RELEASE_STATUS_LABELS[releaseStatus]}`
      : existingStatus !== "not_requested"
      ? `Request status: ${WITHDRAWAL_STATUS_LABELS[existingStatus]}`
      : `${formatCurrency(availableAmount, currency)} available`;

  return (
    <div className={cn("space-y-2", fullWidth && "w-full")}>
      <Button
        asChild
        className={cn(
          "h-12 rounded-xl shadow-2xl shadow-primary/20",
          fullWidth && "w-full",
          className
        )}
      >
        <Link href={href}>
          {locked ? (
            <Lock className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          )}
          Withdraw / Transfer
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        {helper}
      </p>
    </div>
  );
}

export default WithdrawalRequestDialog;

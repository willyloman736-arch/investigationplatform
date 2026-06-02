"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ContractVerificationPanel — admin reviews & verifies the case contract.
//
// Shows the contract terms and each party's signature state, and lets the admin
// record a party's acceptance via the `signContract` server action (the contract
// control available in this MVP). Signing the contract is NOT a release approval
// — release approvals live in the ApprovalPanel / approvals.ts and require BOTH
// parties. This panel never moves funds.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  FileSignature,
  Loader2,
  CheckCircle2,
  Circle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Case } from "@/lib/types";
import { signContract } from "@/lib/actions/cases";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface ContractVerificationPanelProps {
  case: Case;
  className?: string;
}

export function ContractVerificationPanel({
  case: caseRow,
  className,
}: ContractVerificationPanelProps) {
  const router = useRouter();
  const [pendingParty, setPendingParty] = useState<
    "party_a" | "party_b" | null
  >(null);
  const [, startTransition] = useTransition();

  const bothSigned =
    caseRow.contract_signed_by_a && caseRow.contract_signed_by_b;

  function recordSignature(party: "party_a" | "party_b") {
    setPendingParty(party);
    startTransition(async () => {
      try {
        const result = await signContract({ caseId: caseRow.id, party });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not record the signature.");
        } else {
          toast.success(
            `Recorded ${party === "party_a" ? "Party A" : "Party B"} acceptance of the contract.`
          );
          router.refresh();
        }
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not record the signature."
        );
      } finally {
        setPendingParty(null);
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-md sm:p-6",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <FileSignature className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Contract verification
          </h3>
          <p className="text-xs text-muted-foreground">
            Review the agreed terms and confirm both parties have accepted.
          </p>
        </div>
      </div>

      {/* Terms */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Contract terms
        </p>
        {caseRow.contract_terms ? (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {caseRow.contract_terms}
          </p>
        ) : (
          <p className="mt-1 text-sm italic text-muted-foreground">
            No contract terms recorded for this case yet.
          </p>
        )}
      </div>

      {/* Signature state + record controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SignatureRow
          label="Party A"
          signed={caseRow.contract_signed_by_a}
          pending={pendingParty === "party_a"}
          onRecord={() => recordSignature("party_a")}
        />
        <SignatureRow
          label="Party B"
          signed={caseRow.contract_signed_by_b}
          pending={pendingParty === "party_b"}
          onRecord={() => recordSignature("party_b")}
        />
      </div>

      {bothSigned ? (
        <Alert variant="success" className="mt-4">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Contract fully accepted</AlertTitle>
          <AlertDescription>
            Both parties have accepted the contract terms. Note: this is separate
            from release approval, which also requires both parties and is handled
            in the approvals workflow.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Recording a signature confirms a party accepted the terms. It does not
          release funds.
        </p>
      )}
    </div>
  );
}

function SignatureRow({
  label,
  signed,
  pending,
  onRecord,
}: {
  label: string;
  signed: boolean;
  pending: boolean;
  onRecord: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm">
        {signed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium text-foreground">{label}</span>
        <span
          className={cn(
            "text-xs",
            signed ? "text-emerald-400" : "text-muted-foreground"
          )}
        >
          {signed ? "Signed" : "Not signed"}
        </span>
      </span>
      {!signed && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRecord}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Recording…
            </>
          ) : (
            "Record signature"
          )}
        </Button>
      )}
    </div>
  );
}

export default ContractVerificationPanel;

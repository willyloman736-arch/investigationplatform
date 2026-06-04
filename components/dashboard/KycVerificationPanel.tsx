"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, IdCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { submitKycVerification } from "@/lib/actions/client-operations";
import { KYC_STATUS_LABELS } from "@/lib/constants";
import type { Profile, RecoveryOperationsCase } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface KycVerificationPanelProps {
  profile: Profile;
  operations: RecoveryOperationsCase[];
}

export function KycVerificationPanel({
  profile,
  operations,
}: KycVerificationPanelProps) {
  const router = useRouter();
  const actionable = operations.filter(
    (operation) => (operation.kyc?.status ?? "not_started") !== "verified"
  );
  const [caseId, setCaseId] = React.useState(
    actionable[0]?.id ?? operations[0]?.id ?? ""
  );
  const [legalName, setLegalName] = React.useState(profile.full_name ?? "");
  const [phone, setPhone] = React.useState(profile.phone ?? "");
  const [governmentIdReference, setGovernmentIdReference] = React.useState("");
  const [proofOfAddressReference, setProofOfAddressReference] =
    React.useState("");
  const [selfieConfirmed, setSelfieConfirmed] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const selected = operations.find((operation) => operation.id === caseId);
  const selectedStatus = selected?.kyc?.status ?? "not_started";
  const verifiedCount = operations.filter(
    (operation) => operation.kyc?.status === "verified"
  ).length;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) {
      toast.error("Open a recovery case first.");
      return;
    }

    startTransition(async () => {
      const result = await submitKycVerification({
        caseId,
        legalName,
        phone,
        governmentIdReference,
        proofOfAddressReference,
        selfieConfirmed,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not submit KYC.");
        return;
      }

      toast.success("KYC submitted for review.");
      setGovernmentIdReference("");
      setProofOfAddressReference("");
      setSelfieConfirmed(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-primary/20 bg-primary/[0.065] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
            Required verification
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Complete KYC verification
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            KYC is required automatically for every recovery case and escrow
            account. Submit your identity references here so transfer
            eligibility can be reviewed without waiting for a manual request.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:w-[320px]">
          <KycMiniStat
            label="Verified"
            value={`${verifiedCount}/${operations.length || 0}`}
            good={verifiedCount > 0}
          />
          <KycMiniStat
            label="Current"
            value={KYC_STATUS_LABELS[selectedStatus]}
            good={selectedStatus === "verified"}
          />
        </div>
      </div>

      {operations.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-background/35 p-5 text-sm text-muted-foreground">
          Open a recovery case or escrow account first. Your KYC checklist will
          appear here automatically.
        </div>
      ) : selectedStatus === "verified" && actionable.length === 0 ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
          <div>
            <p className="font-semibold text-foreground">KYC verified</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your identity profile is verified for the active case records.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Case / escrow account</Label>
                <Select value={caseId} onValueChange={setCaseId}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-background/40">
                    <SelectValue placeholder="Select a case" />
                  </SelectTrigger>
                  <SelectContent>
                    {operations.map((operation) => (
                      <SelectItem key={operation.id} value={operation.id}>
                        {operation.case_number} -{" "}
                        {KYC_STATUS_LABELS[
                          operation.kyc?.status ?? "not_started"
                        ]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kyc-legal-name">Legal name</Label>
                <Input
                  id="kyc-legal-name"
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                  className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
                  required
                />
              </div>
              <div>
                <Label htmlFor="kyc-phone">Phone number</Label>
                <Input
                  id="kyc-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="kyc-gov-id">Government ID reference</Label>
                <Textarea
                  id="kyc-gov-id"
                  value={governmentIdReference}
                  onChange={(event) =>
                    setGovernmentIdReference(event.target.value)
                  }
                  placeholder="Example: Passport uploaded in case evidence, file name, or secure verification reference."
                  className="mt-2 min-h-[82px] rounded-xl border-white/10 bg-background/40"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="kyc-address">Proof of address reference</Label>
                <Textarea
                  id="kyc-address"
                  value={proofOfAddressReference}
                  onChange={(event) =>
                    setProofOfAddressReference(event.target.value)
                  }
                  placeholder="Example: Utility bill or bank statement uploaded in evidence."
                  className="mt-2 min-h-[82px] rounded-xl border-white/10 bg-background/40"
                  required
                />
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={selfieConfirmed}
                  onChange={(event) => setSelfieConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20"
                />
                <span className="leading-relaxed text-muted-foreground">
                  I confirm my selfie/liveness image is ready for identity
                  review and matches the government ID reference.
                </span>
              </label>
            </div>
          </div>

          <aside className="space-y-3 rounded-2xl border border-white/10 bg-background/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-foreground">KYC status</p>
              <Badge
                variant={
                  selectedStatus === "verified"
                    ? "success"
                    : selectedStatus === "rejected"
                    ? "destructive"
                    : selectedStatus === "in_review"
                    ? "warning"
                    : "secondary"
                }
              >
                {KYC_STATUS_LABELS[selectedStatus]}
              </Badge>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <StatusLine done={Boolean(legalName.trim())} label="Legal name" />
              <StatusLine done={Boolean(phone.trim())} label="Phone contact" />
              <StatusLine
                done={Boolean(governmentIdReference.trim())}
                label="Government ID reference"
              />
              <StatusLine
                done={Boolean(proofOfAddressReference.trim())}
                label="Proof of address reference"
              />
              <StatusLine done={selfieConfirmed} label="Selfie confirmation" />
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-xl shadow-2xl shadow-primary/20"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              Submit KYC
            </Button>
          </aside>
        </form>
      )}
    </section>
  );
}

function KycMiniStat({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3 backdrop-blur-xl">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 truncate text-sm font-semibold",
          good ? "text-emerald-200" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StatusLine({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          done ? "bg-emerald-300" : "bg-muted-foreground/40"
        )}
      />
      <span>{label}</span>
    </div>
  );
}

export default KycVerificationPanel;

"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CreateCaseDialog — admin creates a new case (client component).
//
// Collects the case details + an initial escrow total and (optionally) the two
// party emails, then calls the `createCase` server action. The escrow contract
// is seeded server-side with display-only fee math (platform + provider fees →
// net release). NO money is moved here — this only records intent.
//
// On success it navigates to the new case (skipped in DEMO, which returns a
// placeholder id) and refreshes the list.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Loader2, FilePlus2 } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/utils";
import {
  PLATFORM_FEE_RATE,
  PROVIDER_FEE_RATE,
  PROVIDER_DISCLAIMER,
} from "@/lib/constants";
import { createCase } from "@/lib/actions/cases";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export interface CreateCaseDialogProps {
  children?: React.ReactNode;
}

const DEMO_CASE_ID = "demo-case";

export function CreateCaseDialog({ children }: CreateCaseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contractTerms, setContractTerms] = useState("");
  const [partyAEmail, setPartyAEmail] = useState("");
  const [partyBEmail, setPartyBEmail] = useState("");

  const amountNum = Number(totalAmount) || 0;
  const platformFee = round2(amountNum * PLATFORM_FEE_RATE);
  const providerFee = round2(amountNum * PROVIDER_FEE_RATE);
  const netRelease = round2(amountNum - platformFee - providerFee);

  function reset() {
    setTitle("");
    setCategory("");
    setDescription("");
    setTotalAmount("");
    setCurrency("USD");
    setContractTerms("");
    setPartyAEmail("");
    setPartyBEmail("");
  }

  function handleSubmit() {
    if (title.trim().length < 3) {
      toast.error("Enter a case title (at least 3 characters).");
      return;
    }
    if (amountNum < 0) {
      toast.error("Escrow amount must be zero or greater.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createCase({
          title: title.trim(),
          category: category.trim(),
          description: description.trim(),
          totalAmount: amountNum,
          currency: currency.trim() || "USD",
          contractTerms: contractTerms.trim(),
          partyAEmail: partyAEmail.trim(),
          partyBEmail: partyBEmail.trim(),
        });

        if (result?.success === false) {
          toast.error(result.error ?? "Could not create the case.");
          return;
        }

        toast.success(
          result.data?.caseNumber
            ? `Case ${result.data.caseNumber} created.`
            : "Case created."
        );
        setOpen(false);
        reset();

        const newId = result.data?.caseId;
        if (newId && newId !== DEMO_CASE_ID) {
          router.push(`/admin/cases/${newId}`);
        } else {
          router.refresh();
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not create the case."
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (isPending) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button>
            <Plus className="h-4 w-4" />
            Create case
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-4 w-4 text-primary" />
            Create a new case
          </DialogTitle>
          <DialogDescription>
            Open a new escrow case. You can assign parties now or later. The
            escrow opens in PENDING DEPOSIT — no funds move until the licensed
            provider confirms a deposit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="case-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="case-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cross-border asset recovery — wire trace"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-category">Category</Label>
              <Input
                id="case-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Asset Recovery"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-currency">Currency</Label>
              <Input
                id="case-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={8}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="case-amount">
              Escrow total <span className="text-destructive">*</span>
            </Label>
            <Input
              id="case-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
            />
            {amountNum > 0 && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                <p className="mb-1.5 font-medium text-muted-foreground">
                  Display-only fee breakdown
                </p>
                <dl className="space-y-1">
                  <FeeRow
                    label="Platform fee"
                    sub={`${(PLATFORM_FEE_RATE * 100).toFixed(1)}%`}
                    value={formatCurrency(platformFee, currency)}
                  />
                  <FeeRow
                    label="Provider fee"
                    sub={`${(PROVIDER_FEE_RATE * 100).toFixed(1)}%`}
                    value={formatCurrency(providerFee, currency)}
                  />
                  <div className="my-1 h-px bg-white/10" />
                  <FeeRow
                    label="Net release"
                    value={formatCurrency(netRelease, currency)}
                    accent
                  />
                </dl>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="case-description">Description</Label>
            <Textarea
              id="case-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of the engagement, deliverables, and release conditions."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="case-terms">Contract terms</Label>
            <Textarea
              id="case-terms"
              value={contractTerms}
              onChange={(e) => setContractTerms(e.target.value)}
              placeholder="Conditions both parties must accept before release becomes eligible."
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-party-a">Party A email</Label>
              <Input
                id="case-party-a"
                type="email"
                value={partyAEmail}
                onChange={(e) => setPartyAEmail(e.target.value)}
                placeholder="party-a@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-party-b">Party B email</Label>
              <Input
                id="case-party-b"
                type="email"
                value={partyBEmail}
                onChange={(e) => setPartyBEmail(e.target.value)}
                placeholder="party-b@example.com"
              />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {PROVIDER_DISCLAIMER}
          </p>
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
            onClick={handleSubmit}
            disabled={isPending || title.trim().length < 3}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create case
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeeRow({
  label,
  sub,
  value,
  accent,
}: {
  label: string;
  sub?: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">
        {label}
        {sub && <span className="ml-1 text-[10px] opacity-70">({sub})</span>}
      </dt>
      <dd
        className={
          accent
            ? "font-semibold tabular-nums text-cyan-300"
            : "tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default CreateCaseDialog;

"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { submitWithdrawalRequest } from "@/lib/actions/withdrawals";
import {
  PAYOUT_METHOD_LABELS,
  PROVIDER_FEE_RATE,
  RELEASE_STATUS_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/lib/constants";
import type {
  EscrowContract,
  KycStatus,
  PayoutMethod,
  Profile,
  RecoveryOperationsCase,
  WithdrawalRequest,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
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

type Step = "method" | "details" | "confirm" | "success";

interface WithdrawalFlowProps {
  profile: Profile;
  operation: RecoveryOperationsCase;
  escrow: EscrowContract;
  availableAmount: number;
  kycStatus: KycStatus;
}

interface FormState {
  amount: string;
  accountHolderName: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
  billingCountry: string;
  cardholderName: string;
  billingPostalCode: string;
  paypalEmail: string;
  confirmPaypalEmail: string;
}

const METHOD_DETAILS: Record<
  PayoutMethod,
  {
    label: string;
    description: string;
    badge: string;
    payoutTime: string;
    button: string;
    icon: typeof Banknote;
  }
> = {
  bank_transfer: {
    label: "Bank Transfer",
    description: "Send funds directly to your verified bank account.",
    badge: "Recommended",
    payoutTime: "1-3 business days",
    button: "Select Bank Transfer",
    icon: Banknote,
  },
  card: {
    label: "Visa / Mastercard",
    description: "Transfer to an eligible debit card where supported.",
    badge: "Fast",
    payoutTime: "Instant to 30 minutes where available",
    button: "Select Card Payout",
    icon: CreditCard,
  },
  paypal: {
    label: "PayPal",
    description: "Transfer using a connected PayPal account.",
    badge: "External Provider",
    payoutTime: "Provider dependent",
    button: "Select PayPal",
    icon: Mail,
  },
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function methodProvider(method: PayoutMethod): string {
  if (method === "card") return "Stripe";
  if (method === "paypal") return "PayPal";
  return "Banking partner";
}

function arrivalFor(method: PayoutMethod | null): string {
  if (!method) return "After final provider verification";
  return METHOD_DETAILS[method].payoutTime;
}

function initialForm(availableAmount: number): FormState {
  return {
    amount: availableAmount > 0 ? String(round2(availableAmount)) : "",
    accountHolderName: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "checking",
    billingCountry: "United States",
    cardholderName: "",
    billingPostalCode: "",
    paypalEmail: "",
    confirmPaypalEmail: "",
  };
}

function amountFrom(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function WithdrawalFlow({
  profile,
  operation,
  escrow,
  availableAmount,
  kycStatus,
}: WithdrawalFlowProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("method");
  const [method, setMethod] = React.useState<PayoutMethod | null>(null);
  const [form, setForm] = React.useState<FormState>(() =>
    initialForm(availableAmount)
  );
  const [submitted, setSubmitted] = React.useState<WithdrawalRequest | null>(
    null
  );
  const [isPending, startTransition] = React.useTransition();

  const amount = round2(amountFrom(form.amount));
  const providerFee = round2(amount * PROVIDER_FEE_RATE);
  const netAmount = round2(Math.max(0, amount - providerFee));
  const selectedDetails = method ? METHOD_DETAILS[method] : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function choose(nextMethod: PayoutMethod) {
    setMethod(nextMethod);
    setStep("details");
  }

  function validateDetails(): boolean {
    if (!method) {
      toast.error("Select a withdrawal method.");
      return false;
    }
    if (amount <= 0) {
      toast.error("Enter a withdrawal amount.");
      return false;
    }
    if (amount > availableAmount) {
      toast.error("Amount exceeds your available balance.");
      return false;
    }
    if (method === "bank_transfer") {
      if (!form.accountHolderName.trim()) return toastError("Enter the account holder name.");
      if (!form.bankName.trim()) return toastError("Enter the bank name.");
      if (!form.routingNumber.trim()) return toastError("Enter the routing number.");
      if (!form.accountNumber.trim()) return toastError("Enter the account number.");
      if (!form.accountType.trim()) return toastError("Select the account type.");
      if (!form.billingCountry.trim()) return toastError("Enter the billing country.");
    }
    if (method === "card") {
      if (!form.cardholderName.trim()) return toastError("Enter the cardholder name.");
      if (!form.billingPostalCode.trim()) return toastError("Enter the billing ZIP or postal code.");
    }
    if (method === "paypal") {
      if (!form.paypalEmail.trim()) return toastError("Enter your PayPal email.");
      if (form.paypalEmail.trim() !== form.confirmPaypalEmail.trim()) {
        return toastError("PayPal email confirmation does not match.");
      }
    }
    return true;
  }

  function submit() {
    if (!method || !validateDetails()) return;

    startTransition(async () => {
      const result = await submitWithdrawalRequest({
        caseId: operation.id,
        escrowContractId: escrow.id,
        currency: escrow.currency,
        withdrawalMethod: method,
        ...form,
        amount,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not submit withdrawal request.");
        return;
      }
      if (!result.data) {
        toast.error("Withdrawal request was submitted but could not be displayed.");
        return;
      }

      setSubmitted(result.data);
      setStep("success");
      toast.success("Withdrawal request submitted.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-24 lg:pb-8">
      <header className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Back to dashboard</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Secure payout
          </p>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Withdraw Funds
          </h1>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Stripe-style secure payment
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Secure payouts processed through verified payment providers.
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Verified account: {profile.full_name ?? profile.email}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[320px]">
            <MiniMetric label="Provider" value="Verified" />
            <MiniMetric label="KYC" value="Verified" />
          </div>
        </div>
      </section>

      {step === "success" && submitted ? (
        <SuccessState
          request={submitted}
          method={method ?? submitted.withdrawal_method}
          estimatedArrival={arrivalFor(method ?? submitted.withdrawal_method)}
        />
      ) : (
        <>
          <BalanceCard
            operation={operation}
            escrow={escrow}
            availableAmount={availableAmount}
            kycStatus={kycStatus}
            estimatedArrival={arrivalFor(method)}
          />

          {step === "method" ? (
            <MethodSelection selected={method} onSelect={choose} />
          ) : null}

          {step === "details" && method ? (
            <DetailsStep
              method={method}
              form={form}
              update={update}
              amount={amount}
              availableAmount={availableAmount}
              currency={escrow.currency}
              onBack={() => setStep("method")}
              onContinue={() => {
                if (validateDetails()) setStep("confirm");
              }}
            />
          ) : null}

          {step === "confirm" && method && selectedDetails ? (
            <ConfirmStep
              amount={amount}
              method={method}
              providerFee={providerFee}
              netAmount={netAmount}
              currency={escrow.currency}
              estimatedArrival={selectedDetails.payoutTime}
              caseNumber={operation.case_number}
              onBack={() => setStep("details")}
              onSubmit={submit}
              isPending={isPending}
            />
          ) : null}
        </>
      )}

      <WithdrawalTrustBadges />
    </div>
  );
}

function toastError(message: string): false {
  toast.error(message);
  return false;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function BalanceCard({
  operation,
  escrow,
  availableAmount,
  kycStatus,
  estimatedArrival,
}: {
  operation: RecoveryOperationsCase;
  escrow: EscrowContract;
  availableAmount: number;
  kycStatus: KycStatus;
  estimatedArrival: string;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Available Balance
          </p>
          <p className="mt-2 break-words text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {formatCurrency(availableAmount, escrow.currency)}
          </p>
        </div>
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/25">
          <Wallet className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <InfoTile label="Escrow Case ID" value={operation.case_number} />
        <InfoTile
          label="Release Status"
          value={RELEASE_STATUS_LABELS[escrow.release_status]}
        />
        <InfoTile label="KYC Status" value={kycStatus === "verified" ? "Verified" : "Pending"} />
        <InfoTile label="Estimated Payout" value={estimatedArrival} />
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MethodSelection({
  selected,
  onSelect,
}: {
  selected: PayoutMethod | null;
  onSelect: (method: PayoutMethod) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Withdrawal method
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          Choose payout destination
        </h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(METHOD_DETAILS) as PayoutMethod[]).map((method) => {
          const detail = METHOD_DETAILS[method];
          const Icon = detail.icon;
          const active = selected === method;
          return (
            <article
              key={method}
              className={cn(
                "rounded-3xl border bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors",
                active ? "border-primary/35" : "border-white/10"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <Badge variant={method === "bank_transfer" ? "success" : "info"}>
                  {detail.badge}
                </Badge>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {detail.label}
              </h3>
              <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-muted-foreground">
                {detail.description}
              </p>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                {detail.payoutTime}
              </p>
              <Button
                type="button"
                onClick={() => onSelect(method)}
                className="mt-4 h-12 w-full rounded-xl"
                variant={active ? "default" : "outline"}
              >
                {detail.button}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DetailsStep({
  method,
  form,
  update,
  amount,
  availableAmount,
  currency,
  onBack,
  onContinue,
}: {
  method: PayoutMethod;
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  amount: number;
  availableAmount: number;
  currency: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {PAYOUT_METHOD_LABELS[method]}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            Payout details
          </h2>
        </div>
        <Badge variant="info">{methodProvider(method)}</Badge>
      </div>

      <div className="mt-5">
        <Label htmlFor="withdraw-amount">Withdrawal amount</Label>
        <Input
          id="withdraw-amount"
          value={form.amount}
          onChange={(event) => update("amount", event.target.value)}
          inputMode="decimal"
          className="mt-2 h-12 rounded-xl border-white/10 bg-background/40 text-base"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {formatCurrency(availableAmount, currency)} maximum available. Current
          request: {formatCurrency(amount, currency)}.
        </p>
      </div>

      <div className="mt-5">
        {method === "bank_transfer" ? (
          <BankFields form={form} update={update} />
        ) : null}
        {method === "card" ? <CardFields form={form} update={update} /> : null}
        {method === "paypal" ? (
          <PaypalFields form={form} update={update} />
        ) : null}
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={onBack} className="h-12 rounded-xl">
          Back
        </Button>
        <Button type="button" onClick={onContinue} className="h-12 rounded-xl">
          Continue
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function BankFields({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="account-holder"
        label="Account holder name"
        value={form.accountHolderName}
        onChange={(value) => update("accountHolderName", value)}
      />
      <Field
        id="bank-name"
        label="Bank name"
        value={form.bankName}
        onChange={(value) => update("bankName", value)}
      />
      <Field
        id="routing-number"
        label="Routing number"
        value={form.routingNumber}
        onChange={(value) => update("routingNumber", value)}
        inputMode="numeric"
      />
      <Field
        id="account-number"
        label="Account number"
        value={form.accountNumber}
        onChange={(value) => update("accountNumber", value)}
        inputMode="numeric"
      />
      <div>
        <Label>Account type</Label>
        <Select
          value={form.accountType}
          onValueChange={(value) => update("accountType", value)}
        >
          <SelectTrigger className="mt-2 h-12 rounded-xl border-white/10 bg-background/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checking">Checking</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field
        id="billing-country"
        label="Billing country"
        value={form.billingCountry}
        onChange={(value) => update("billingCountry", value)}
      />
    </div>
  );
}

function CardFields({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid gap-4">
      <Field
        id="cardholder-name"
        label="Cardholder name"
        value={form.cardholderName}
        onChange={(value) => update("cardholderName", value)}
      />
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.07] p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Card details through Stripe Elements only
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Card number, expiry, and CVC are collected by the secure provider
              step. They are never stored in this dashboard form.
            </p>
          </div>
        </div>
      </div>
      <Field
        id="billing-postal-code"
        label="Billing ZIP/postal code"
        value={form.billingPostalCode}
        onChange={(value) => update("billingPostalCode", value)}
      />
    </div>
  );
}

function PaypalFields({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="paypal-email"
        label="PayPal email"
        value={form.paypalEmail}
        onChange={(value) => update("paypalEmail", value)}
        inputMode="email"
      />
      <Field
        id="confirm-paypal-email"
        label="Confirm PayPal email"
        value={form.confirmPaypalEmail}
        onChange={(value) => update("confirmPaypalEmail", value)}
        inputMode="email"
      />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="mt-2 h-12 rounded-xl border-white/10 bg-background/40 text-base"
      />
    </div>
  );
}

function ConfirmStep({
  amount,
  method,
  providerFee,
  netAmount,
  currency,
  estimatedArrival,
  caseNumber,
  onBack,
  onSubmit,
  isPending,
}: {
  amount: number;
  method: PayoutMethod;
  providerFee: number;
  netAmount: number;
  currency: string;
  estimatedArrival: string;
  caseNumber: string;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/25">
          <BadgeCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Confirm request
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            Review payout summary
          </h2>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <InfoTile label="Withdrawal amount" value={formatCurrency(amount, currency)} />
        <InfoTile label="Method selected" value={PAYOUT_METHOD_LABELS[method]} />
        <InfoTile label="Provider fee" value={formatCurrency(providerFee, currency)} />
        <InfoTile label="Net amount" value={formatCurrency(netAmount, currency)} />
        <InfoTile label="Estimated arrival" value={estimatedArrival} />
        <InfoTile label="Case ID" value={caseNumber} />
      </div>

      <p className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.07] p-3 text-sm leading-relaxed text-muted-foreground">
        This creates a withdrawal request for final review and provider
        processing. It does not move funds from the browser.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={onBack} className="h-12 rounded-xl">
          Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className="h-12 rounded-xl"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          Submit Withdrawal Request
        </Button>
      </div>
    </section>
  );
}

function SuccessState({
  request,
  method,
  estimatedArrival,
}: {
  request: WithdrawalRequest;
  method: PayoutMethod;
  estimatedArrival: string;
}) {
  return (
    <section className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.08] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/25">
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-2xl font-semibold text-foreground">
        Withdrawal request submitted
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Your payout will be processed after final provider verification.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile label="Request ID" value={request.id} />
        <InfoTile
          label="Amount"
          value={formatCurrency(request.amount, request.currency)}
        />
        <InfoTile label="Method" value={PAYOUT_METHOD_LABELS[method]} />
        <InfoTile label="Estimated arrival" value={estimatedArrival} />
      </div>
      <div className="mt-4">
        <Badge variant="warning">
          Status: {WITHDRAWAL_STATUS_LABELS[request.status] ?? "Pending Review"}
        </Badge>
      </div>
    </section>
  );
}

export function WithdrawalTrustBadges() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Secure payout environment
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <div className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/90 px-4">
          <Image
            src="/trust-badges/stripe-payments.jpeg"
            alt="Stripe payments"
            width={150}
            height={42}
            className="h-9 w-auto object-contain"
          />
        </div>
        <div className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/90 px-4">
          <Image
            src="/trust-badges/ssl-secure.jpeg"
            alt="SSL secure"
            width={136}
            height={42}
            className="h-9 w-auto object-contain"
          />
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Payment brand marks identify supported provider rails and do not imply
        sponsorship. Final payout is subject to eligibility and provider review.
      </p>
    </section>
  );
}

export default WithdrawalFlow;

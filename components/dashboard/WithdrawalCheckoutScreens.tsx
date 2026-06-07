"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileLock2,
  Landmark,
  Lock,
  Mail,
  ShieldCheck,
  UploadCloud,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { submitWithdrawalRequest } from "@/lib/actions/withdrawals";
import {
  PAYOUT_METHOD_LABELS,
  RELEASE_PROCESSING_FEE_PERCENTAGE,
  RELEASE_PROCESSING_FEE_RATE,
} from "@/lib/constants";
import type {
  EscrowContract,
  PayoutMethod,
  Profile,
  RecoveryOperationsCase,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StripeCardSetup } from "@/components/dashboard/StripeCardSetup";

const CHECKOUT_KEY = "dai.withdrawal.checkout";
const SUCCESS_KEY = "dai.withdrawal.success";
const STATUS_COPY =
  "Your payout will become available for processing after release fee requirements have been completed and verified.";

type CheckoutMethod = "bank_transfer" | "card" | "paypal";

interface CheckoutPayload {
  caseId: string;
  escrowContractId: string;
  caseNumber: string;
  amount: number;
  currency: string;
  releaseProcessingFee: number;
  releaseProcessingFeePercentage: number;
  netAmount: number;
  withdrawalMethod: CheckoutMethod;
  methodLabel: string;
  paymentDetails: Record<string, unknown>;
}

interface SuccessPayload {
  requestId: string;
  caseId: string;
  caseNumber: string;
  method: CheckoutMethod;
  methodLabel: string;
  amount: number;
  currency: string;
}

interface MethodPageProps {
  method: CheckoutMethod;
  profile: Profile;
  operation: RecoveryOperationsCase;
  escrow: EscrowContract;
  availableAmount: number;
}

const methodConfig: Record<
  CheckoutMethod,
  {
    title: string;
    subtitle: string;
    route: string;
    icon: LucideIcon;
    button: string;
    badges: string[];
  }
> = {
  bank_transfer: {
    title: "Bank Transfer Checkout",
    subtitle: "Securely transfer funds to complete your release processing requirements.",
    route: "/dashboard/withdraw/bank",
    icon: Landmark,
    button: "Submit Payment For Verification",
    badges: ["SSL Secure", "AES-256 Encryption", "Stripe Secured", "PCI DSS Compliant"],
  },
  card: {
    title: "Card Withdrawal Setup",
    subtitle: "Securely receive your payout through an eligible Visa or Mastercard debit card.",
    route: "/dashboard/withdraw/card",
    icon: CreditCard,
    button: "Continue Securely",
    badges: ["Stripe Secure", "PCI DSS Compliant", "AES-256 Encryption", "Visa Secure"],
  },
  paypal: {
    title: "PayPal Checkout",
    subtitle: "Submit a verified PayPal destination for your payout review.",
    route: "/dashboard/withdraw/paypal",
    icon: Mail,
    button: "Submit Withdrawal Request",
    badges: ["PayPal Verified", "Stripe Secure", "SSL Secure", "PCI DSS"],
  },
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function releaseFeeFor(amount: number) {
  return round2(amount * RELEASE_PROCESSING_FEE_RATE);
}

function cardBrandFrom(value?: string): "Visa" | "Mastercard" | "Card" {
  if (value === "Visa" || value === "Mastercard") return value;
  return "Card";
}

function methodLabel(method: CheckoutMethod, details?: Record<string, unknown>) {
  if (method === "card") {
    const brand =
      typeof details?.cardBrand === "string" ? details.cardBrand : "Visa";
    return `${brand} Debit Card`;
  }
  return PAYOUT_METHOD_LABELS[method];
}

function saveCheckout(payload: CheckoutPayload) {
  window.sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(payload));
}

function loadCheckout(): CheckoutPayload | null {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_KEY);
    return raw ? (JSON.parse(raw) as CheckoutPayload) : null;
  } catch {
    return null;
  }
}

function saveSuccess(payload: SuccessPayload) {
  window.sessionStorage.setItem(SUCCESS_KEY, JSON.stringify(payload));
}

function loadSuccess(): SuccessPayload | null {
  try {
    const raw = window.sessionStorage.getItem(SUCCESS_KEY);
    return raw ? (JSON.parse(raw) as SuccessPayload) : null;
  } catch {
    return null;
  }
}

export function WithdrawalBlockedCheckout({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <PhoneShell title="Withdraw Funds" subtitle="Secure payout setup">
      <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/[0.08] p-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-300/15 text-amber-200">
          <FileLock2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
        <Button asChild className="mt-5 h-12 w-full rounded-2xl">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </PhoneShell>
  );
}

export function WithdrawalMethodCheckout({
  method,
  profile,
  operation,
  escrow,
  availableAmount,
}: MethodPageProps) {
  const router = useRouter();
  const config = methodConfig[method];
  const Icon = config.icon;
  const amount = round2(availableAmount);
  const releaseFee = releaseFeeFor(amount);
  const netAmount = round2(amount - releaseFee);
  const [confirmed, setConfirmed] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, string>>(() =>
    defaultForm(method, profile)
  );

  const brand = cardBrandFrom(form.cardBrand);
  const details = paymentDetailsFor(method, form, brand);

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const required = requiredFields(method);
    for (const field of required) {
      if (!String(form[field] ?? "").trim()) {
        toast.error("Complete all required fields before continuing.");
        return false;
      }
    }
    if (method === "bank_transfer" && form.accountNumber !== form.confirmAccountNumber) {
      toast.error("Account number confirmation does not match.");
      return false;
    }
    if (method === "paypal" && form.paypalEmail !== form.confirmPaypalEmail) {
      toast.error("PayPal email confirmation does not match.");
      return false;
    }
    if (!confirmed) {
      toast.error("Confirm the payment information before continuing.");
      return false;
    }
    return true;
  }

  function continueToReview() {
    if (!validate()) return;
    const methodDisplay = methodLabel(method, details);
    saveCheckout({
      caseId: operation.id,
      escrowContractId: escrow.id,
      caseNumber: operation.case_number,
      amount,
      currency: escrow.currency,
      releaseProcessingFee: releaseFee,
      releaseProcessingFeePercentage: RELEASE_PROCESSING_FEE_PERCENTAGE,
      netAmount,
      withdrawalMethod: method,
      methodLabel: methodDisplay,
      paymentDetails: details,
    });
    router.push("/dashboard/withdraw/review");
  }

  return (
    <PhoneShell title={config.title} subtitle={config.subtitle} trailingIcon={Icon}>
      <TrustStrip badges={config.badges} />
      <EncryptedNotice />
      <PaymentSummary
        amount={amount}
        releaseFee={releaseFee}
        netAmount={netAmount}
        currency={escrow.currency}
        caseNumber={operation.case_number}
        status="Awaiting Verification"
      />

      {method === "bank_transfer" ? (
        <BankForm form={form} update={update} />
      ) : method === "card" ? (
        <CardForm form={form} update={update} brand={brand} caseId={operation.id} />
      ) : (
        <PaypalForm form={form} update={update} />
      )}

      <ReleaseRequirements />
      <label className="flex items-start gap-3 rounded-2xl px-1 text-xs leading-relaxed text-slate-200">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-emerald-400 bg-emerald-400 text-emerald-400"
        />
        <span>I confirm that the payment information provided is accurate.</span>
      </label>
      <Button
        type="button"
        onClick={continueToReview}
        className="h-14 w-full rounded-2xl bg-blue-600 text-base font-semibold shadow-[0_14px_35px_rgba(37,99,235,0.45)] hover:bg-blue-500"
      >
        <Lock className="h-4 w-4" aria-hidden="true" />
        {config.button}
      </Button>
      <p className="pb-2 text-center text-[11px] text-slate-400">
        <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Your data is secure and encrypted
      </p>
    </PhoneShell>
  );
}

export function WithdrawalReviewScreen() {
  const router = useRouter();
  const [payload, setPayload] = React.useState<CheckoutPayload | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    const loaded = loadCheckout();
    if (!loaded) {
      router.replace("/dashboard/withdraw");
      return;
    }
    setPayload(loaded);
  }, [router]);

  if (!payload) {
    return (
      <PhoneShell title="Review Withdrawal Summary" subtitle="Loading secure summary">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5 text-sm text-slate-300">
          Preparing review...
        </div>
      </PhoneShell>
    );
  }

  function submit() {
    if (!payload) return;
    startTransition(async () => {
      const result = await submitWithdrawalRequest({
        caseId: payload.caseId,
        escrowContractId: payload.escrowContractId,
        amount: payload.amount,
        currency: payload.currency,
        withdrawalMethod: payload.withdrawalMethod,
        accountHolderName: String(payload.paymentDetails.accountHolderName ?? ""),
        bankName: String(payload.paymentDetails.bankName ?? ""),
        routingNumber: String(payload.paymentDetails.routingNumber ?? ""),
        accountNumber: String(payload.paymentDetails.accountNumber ?? ""),
        accountType: String(payload.paymentDetails.accountType ?? ""),
        billingCountry: String(payload.paymentDetails.country ?? ""),
        cardholderName: String(payload.paymentDetails.cardholderName ?? ""),
        billingPostalCode: String(payload.paymentDetails.billingZipCode ?? ""),
        cardPaymentMethodId: String(payload.paymentDetails.cardPaymentMethodId ?? ""),
        paypalEmail: String(payload.paymentDetails.paypalEmail ?? ""),
        confirmPaypalEmail: String(payload.paymentDetails.confirmPaypalEmail ?? ""),
        paymentDetails: payload.paymentDetails,
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Could not submit withdrawal request.");
        return;
      }

      saveSuccess({
        requestId: result.data.id,
        caseId: result.data.case_id,
        caseNumber: payload.caseNumber,
        method: payload.withdrawalMethod,
        methodLabel: payload.methodLabel,
        amount: result.data.amount,
        currency: result.data.currency,
      });
      window.sessionStorage.removeItem(CHECKOUT_KEY);
      toast.success("Withdrawal request submitted successfully.");
      router.push("/dashboard/withdraw/success");
      router.refresh();
    });
  }

  return (
    <PhoneShell title="Review Withdrawal Summary" subtitle="Please review your details before submitting your withdrawal request.">
      <ReviewBreakdown payload={payload} />
      <SelectedMethodCard payload={payload} />
      <div className="rounded-[18px] border border-white/10 bg-white/[0.055] p-4 text-sm leading-relaxed text-slate-300">
        <Lock className="mr-2 inline h-5 w-5 text-white" aria-hidden="true" />
        {STATUS_COPY}
      </div>
      <Button
        type="button"
        onClick={submit}
        disabled={pending}
        className="h-14 w-full rounded-2xl bg-blue-600 text-base font-semibold shadow-[0_14px_35px_rgba(37,99,235,0.45)] hover:bg-blue-500"
      >
        <Lock className="h-4 w-4" aria-hidden="true" />
        {pending ? "Submitting Securely..." : "Submit Withdrawal Request"}
      </Button>
      <p className="pb-2 text-center text-[11px] text-slate-400">
        <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Powered by secure provider verification
      </p>
    </PhoneShell>
  );
}

export function WithdrawalSuccessScreen() {
  const router = useRouter();
  const [payload, setPayload] = React.useState<SuccessPayload | null>(null);

  React.useEffect(() => {
    const loaded = loadSuccess();
    if (!loaded) {
      router.replace("/dashboard");
      return;
    }
    setPayload(loaded);
  }, [router]);

  if (!payload) return null;

  return (
    <PhoneShell title="" subtitle="" hideHeader>
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] px-5 py-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.22),transparent_42%)]" />
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 shadow-[0_0_55px_rgba(34,197,94,0.55)]"
        >
          <Check className="h-14 w-14 text-white" aria-hidden="true" />
        </motion.div>
        <h1 className="relative mt-7 text-3xl font-semibold text-white">
          Withdrawal Request Submitted
        </h1>
        <p className="relative mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-300">
          Your payout will be scheduled for processing after release fee verification has been completed.
        </p>
        <div className="relative mt-5 inline-flex rounded-full border border-amber-300/20 bg-amber-300/15 px-4 py-2 text-sm font-semibold text-amber-200">
          Pending Verification
        </div>
        <div className="relative mt-7 rounded-[22px] border border-white/10 bg-slate-950/35 p-4 text-left">
          <SummaryRow label="Request ID" value={payload.requestId} />
          <SummaryRow label="Case ID" value={payload.caseNumber} />
          <SummaryRow label="Method" value={payload.methodLabel} />
          <SummaryRow
            label="Amount"
            value={formatCurrency(payload.amount, payload.currency)}
          />
        </div>
        <Button
          type="button"
          onClick={() => router.push("/dashboard/escrow")}
          className="relative mt-7 h-14 w-full rounded-2xl bg-blue-600 text-base font-semibold shadow-[0_14px_35px_rgba(37,99,235,0.45)] hover:bg-blue-500"
        >
          Return To Escrow Dashboard
        </Button>
      </div>
    </PhoneShell>
  );
}

function PhoneShell({
  title,
  subtitle,
  children,
  trailingIcon: TrailingIcon = ShieldCheck,
  hideHeader = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  trailingIcon?: typeof ShieldCheck;
  hideHeader?: boolean;
}) {
  return (
    <main className="min-h-[calc(100vh-2rem)] bg-[#001b2c] px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] text-white lg:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[34px] border border-white/15 bg-[#041122]/95 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
      >
        <StatusBar />
        {!hideHeader ? (
          <>
            <div className="mt-5 flex items-center justify-between">
              <Link
                href="/dashboard/withdraw"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-slate-200">
                <TrailingIcon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <header className="mt-6">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">
                {title}
              </h1>
              <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-slate-300">
                {subtitle}
              </p>
            </header>
          </>
        ) : null}
        <div className={cn("space-y-4", hideHeader ? "mt-2" : "mt-4")}>{children}</div>
        <div className="mx-auto mt-4 h-1.5 w-32 rounded-full bg-white" />
      </motion.div>
    </main>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-1 text-sm font-semibold text-white">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-4 rounded-sm border border-white/80" />
        <span className="h-2.5 w-1 rounded-sm bg-white" />
      </span>
    </div>
  );
}

function TrustStrip({ badges }: { badges: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-[12px] border border-white/10 bg-white/[0.055] p-2">
      {badges.map((badge) => (
        <div key={badge} className="min-w-0 text-center">
          <ShieldCheck className="mx-auto h-4 w-4 text-emerald-400" aria-hidden="true" />
          <p className="mt-1 truncate text-[9px] font-semibold leading-tight text-slate-300">
            {badge}
          </p>
        </div>
      ))}
    </div>
  );
}

function EncryptedNotice() {
  return (
    <div className="flex items-center gap-2 rounded-[14px] border border-emerald-400/15 bg-emerald-400/[0.08] px-3 py-3 text-xs font-medium text-slate-200">
      <Lock className="h-4 w-4 text-emerald-400" aria-hidden="true" />
      Your information is encrypted and securely transmitted.
    </div>
  );
}

function PaymentSummary({
  amount,
  releaseFee,
  netAmount,
  currency,
  caseNumber,
  status,
}: {
  amount: number;
  releaseFee: number;
  netAmount: number;
  currency: string;
  caseNumber: string;
  status: string;
}) {
  return (
    <GlassCard title="Payment Summary" icon={WalletCards}>
      <SummaryRow label="Withdrawal Amount" value={formatCurrency(amount, currency)} />
      <SummaryRow
        label={`Release Processing Fee (${RELEASE_PROCESSING_FEE_PERCENTAGE}%)`}
        value={formatCurrency(releaseFee, currency)}
      />
      <SummaryRow label="Case ID" value={caseNumber} />
      <SummaryRow
        label="Payment Status"
        value={<StatusPill label={status} tone="amber" />}
      />
      <div className="my-3 h-px bg-white/10" />
      <SummaryRow
        label="Net Payout Amount"
        value={formatCurrency(netAmount, currency)}
        valueClassName="text-emerald-400 text-xl"
      />
    </GlassCard>
  );
}

function ReviewBreakdown({ payload }: { payload: CheckoutPayload }) {
  return (
    <GlassCard title="Payout Breakdown" icon={WalletCards}>
      <SummaryRow
        label="Withdrawal Amount"
        value={formatCurrency(payload.amount, payload.currency)}
      />
      <SummaryRow
        label="Release Processing Fee"
        value={`-${formatCurrency(payload.releaseProcessingFee, payload.currency)}`}
        valueClassName="text-rose-300"
      />
      <div className="my-3 h-px bg-white/10" />
      <SummaryRow
        label="Net Payout Amount"
        value={formatCurrency(payload.netAmount, payload.currency)}
        valueClassName="text-emerald-400 text-xl"
      />
    </GlassCard>
  );
}

function SelectedMethodCard({ payload }: { payload: CheckoutPayload }) {
  const details = payload.paymentDetails;
  const last4 = String(details.cardLast4 ?? details.accountLast4 ?? "4242");

  return (
    <GlassCard title={payload.withdrawalMethod === "card" ? "Selected Card" : "Selected Method"} icon={CreditCard}>
      <div className="rounded-[18px] border border-white/10 bg-gradient-to-br from-slate-800 to-blue-950 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">
            {String(details.cardholderName ?? details.accountHolderName ?? details.paypalEmail ?? "Verified account")}
          </p>
          <p className="text-xl font-bold uppercase text-white">
            {payload.withdrawalMethod === "paypal"
              ? "PayPal"
              : payload.withdrawalMethod === "card"
              ? String(details.cardBrand ?? "Visa")
              : "Bank"}
          </p>
        </div>
        <p className="mt-4 font-mono text-lg tracking-[0.12em] text-white">
          {payload.withdrawalMethod === "paypal"
            ? String(details.paypalEmail ?? "paypal@example.com")
            : payload.withdrawalMethod === "card" && !details.cardLast4
            ? "Stripe secured payout method"
            : `••••  ••••  ••••  ${last4}`}
        </p>
      </div>
      <SummaryRow label="Case ID" value={payload.caseNumber} />
      <SummaryRow label="Withdrawal Method" value={payload.methodLabel} />
      <SummaryRow
        label="Status"
        value={<StatusPill label="Pending Verification" tone="amber" />}
      />
    </GlassCard>
  );
}

function ReleaseRequirements() {
  return (
    <div className="rounded-[20px] border border-blue-300/20 bg-blue-400/[0.08] p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-400" aria-hidden="true" />
        <div>
          <h3 className="text-base font-semibold text-white">
            Release Processing Requirements
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            To finalize your withdrawal request, the applicable release processing fee must be completed and verified. Once verification is successful, your payout will be scheduled and made available through your selected withdrawal method.
          </p>
        </div>
      </div>
    </div>
  );
}

function BankForm({
  form,
  update,
}: {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
}) {
  return (
    <>
      <GlassCard title="Bank Information" icon={Landmark} subtitle="Please provide your bank details accurately.">
        <div className="grid grid-cols-2 gap-2">
          <InputField label="Account Holder Name" value={form.accountHolderName} onChange={(v) => update("accountHolderName", v)} />
          <InputField label="Bank Name" value={form.bankName} onChange={(v) => update("bankName", v)} />
          <InputField label="Routing Number" value={form.routingNumber} onChange={(v) => update("routingNumber", v)} inputMode="numeric" />
          <InputField label="Account Number" value={form.accountNumber} onChange={(v) => update("accountNumber", v)} inputMode="numeric" />
          <InputField label="Confirm Account Number" value={form.confirmAccountNumber} onChange={(v) => update("confirmAccountNumber", v)} inputMode="numeric" />
          <SelectField label="Account Type" value={form.accountType} onChange={(v) => update("accountType", v)} options={["Checking", "Savings", "Business"]} />
          <SelectField label="Country" value={form.country} onChange={(v) => update("country", v)} options={["United States", "Canada", "United Kingdom"]} />
          <InputField label="Address" value={form.address} onChange={(v) => update("address", v)} />
          <InputField label="City" value={form.city} onChange={(v) => update("city", v)} />
          <InputField label="State" value={form.state} onChange={(v) => update("state", v)} />
          <InputField label="ZIP Code" value={form.zipCode} onChange={(v) => update("zipCode", v)} inputMode="numeric" />
          <InputField label="Phone Number" value={form.phoneNumber} onChange={(v) => update("phoneNumber", v)} />
          <InputField label="Email" value={form.email} onChange={(v) => update("email", v)} inputMode="email" className="col-span-2" />
        </div>
      </GlassCard>
      <PaymentMethodRail method="bank_transfer" />
      <UploadCard />
    </>
  );
}

function CardForm({
  form,
  update,
  brand,
  caseId,
}: {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  brand: "Visa" | "Mastercard" | "Card";
  caseId: string;
}) {
  return (
    <>
      <GlassCard title="Card Details" icon={CreditCard} rightLabel="Secured by Stripe">
        <div className="grid gap-2">
          <InputField label="Cardholder Name" value={form.cardholderName} onChange={(v) => update("cardholderName", v)} />
          <InputField label="Billing ZIP Code" value={form.billingZipCode} onChange={(v) => update("billingZipCode", v)} inputMode="numeric" />
          <SelectField label="Country" value={form.country} onChange={(v) => update("country", v)} options={["United States", "Canada", "United Kingdom"]} />
          <InputField label="Phone Number" value={form.phoneNumber} onChange={(v) => update("phoneNumber", v)} />
          <InputField label="Email" value={form.email} onChange={(v) => update("email", v)} inputMode="email" />
        </div>
        <div className="mt-3">
          <StripeCardSetup
            caseId={caseId}
            cardholderName={form.cardholderName}
            postalCode={form.billingZipCode}
            paymentMethodId={form.cardPaymentMethodId}
            onPaymentMethodId={(paymentMethodId) =>
              update("cardPaymentMethodId", paymentMethodId)
            }
            onBrand={(nextBrand) => update("cardBrand", nextBrand)}
          />
        </div>
        <CardPreview form={form} brand={brand} />
      </GlassCard>
      <PaymentMethodRail method="card" />
    </>
  );
}

function PaypalForm({
  form,
  update,
}: {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
}) {
  return (
    <>
      <GlassCard title="PayPal Account" icon={Mail} subtitle="Submit the PayPal account that should receive your payout.">
        <div className="grid gap-2">
          <InputField label="PayPal Email" value={form.paypalEmail} onChange={(v) => update("paypalEmail", v)} inputMode="email" />
          <InputField label="Confirm PayPal Email" value={form.confirmPaypalEmail} onChange={(v) => update("confirmPaypalEmail", v)} inputMode="email" />
          <SelectField label="Country" value={form.country} onChange={(v) => update("country", v)} options={["United States", "Canada", "United Kingdom"]} />
          <InputField label="Phone Number" value={form.phoneNumber} onChange={(v) => update("phoneNumber", v)} />
          <SelectField label="Preferred Currency" value={form.preferredCurrency} onChange={(v) => update("preferredCurrency", v)} options={["USD", "CAD", "GBP", "EUR"]} />
        </div>
        <div className="mt-3 rounded-[20px] border border-white/10 bg-white/[0.055] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">PayPal account preview</p>
            <p className="text-2xl font-bold text-[#009cde]">PayPal</p>
          </div>
          <p className="mt-4 text-sm text-slate-300">{form.paypalEmail || "paypal@example.com"}</p>
          <StatusPill label="External Provider" tone="blue" />
        </div>
      </GlassCard>
      <PaymentMethodRail method="paypal" />
    </>
  );
}

function CardPreview({
  form,
  brand,
}: {
  form: Record<string, string>;
  brand: "Visa" | "Mastercard" | "Card";
}) {
  return (
    <div className="mt-3 rounded-[20px] border border-white/10 bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900 p-4 shadow-inner">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-emerald-300">Live Card Preview</p>
        <p className="text-2xl font-black uppercase text-white">{brand}</p>
      </div>
      <p className="mt-6 text-xs uppercase tracking-[0.16em] text-slate-300">
        {form.cardholderName || "John Anderson"}
      </p>
      <p className="mt-3 font-mono text-lg tracking-[0.12em] text-white">
        {form.cardPaymentMethodId ? "••••  ••••  ••••  secured" : "••••  ••••  ••••  ••••"}
      </p>
      <p className="mt-4 text-xs text-slate-300">
        {form.cardPaymentMethodId ? "TOKENIZED BY STRIPE" : "SECURE FIELD PENDING"}
      </p>
    </div>
  );
}

function PaymentMethodRail({ method }: { method: CheckoutMethod }) {
  const active = method === "bank_transfer" ? "Bank Transfer" : method === "paypal" ? "PayPal" : "Visa";
  return (
    <GlassCard title="Payment Method" icon={CreditCard} rightLabel="Verified Payment Processing">
      <div className="grid grid-cols-4 gap-2">
        {["Bank Transfer", "Visa", "Mastercard", "Stripe"].map((item) => (
          <div
            key={item}
            className={cn(
              "rounded-[14px] border p-3 text-center text-xs font-bold",
              active === item
                ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                : "border-white/10 bg-white/[0.035] text-slate-300"
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function UploadCard() {
  return (
    <GlassCard title="Payment Confirmation" icon={UploadCloud} subtitle="Upload a copy of your payment receipt for verification.">
      <div className="rounded-[18px] border border-dashed border-white/20 bg-slate-950/25 p-6 text-center">
        <UploadCloud className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-white">Drag and drop your file here</p>
        <p className="text-xs text-slate-400">PNG, JPG, PDF up to 10MB</p>
      </div>
    </GlassCard>
  );
}

function GlassCard({
  title,
  subtitle,
  icon: Icon,
  rightLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-white/12 bg-white/[0.065] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon className="mt-1 h-5 w-5 text-white" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-300">{subtitle}</p> : null}
          </div>
        </div>
        {rightLabel ? (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">
            {rightLabel}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  inputMode,
  placeholder,
  rightText,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  rightText?: string;
  className?: string;
}) {
  return (
    <label className={cn("block rounded-[14px] border border-white/10 bg-slate-950/25 px-3 py-2", className)}>
      <span className="text-[10px] font-medium text-slate-400">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
        />
        {rightText ? <span className="text-xs font-black text-white">{rightText}</span> : null}
        {value ? <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : null}
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block rounded-[14px] border border-white/10 bg-slate-950/25 px-3 py-2">
      <span className="text-[10px] font-medium text-slate-400">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-semibold text-white outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-slate-950 text-white">
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="h-4 w-4 text-slate-300" aria-hidden="true" />
      </span>
    </label>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-300">{label}</span>
      <span className={cn("text-right font-semibold text-white", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "amber" | "blue";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone === "amber"
          ? "border-amber-300/25 bg-amber-300/15 text-amber-200"
          : "border-blue-300/25 bg-blue-400/15 text-blue-200"
      )}
    >
      {label}
    </span>
  );
}

function defaultForm(method: CheckoutMethod, profile: Profile): Record<string, string> {
  const common = {
    country: "United States",
    phoneNumber: profile.phone ?? "",
    email: profile.email,
  };

  if (method === "bank_transfer") {
    return {
      ...common,
      accountHolderName: profile.full_name ?? "",
      bankName: "",
      routingNumber: "",
      accountNumber: "",
      confirmAccountNumber: "",
      accountType: "Checking",
      address: "",
      city: "",
      state: "",
      zipCode: "",
    };
  }

  if (method === "card") {
    return {
      ...common,
      cardholderName: profile.full_name ?? "",
      billingZipCode: "",
      cardPaymentMethodId: "",
      cardBrand: "Visa",
    };
  }

  return {
    ...common,
    paypalEmail: profile.email,
    confirmPaypalEmail: "",
    preferredCurrency: "USD",
  };
}

function requiredFields(method: CheckoutMethod) {
  if (method === "bank_transfer") {
    return [
      "accountHolderName",
      "bankName",
      "routingNumber",
      "accountNumber",
      "confirmAccountNumber",
      "accountType",
      "country",
      "address",
      "city",
      "state",
      "zipCode",
      "phoneNumber",
      "email",
    ];
  }
  if (method === "card") {
    return [
      "cardholderName",
      "billingZipCode",
      "cardPaymentMethodId",
      "country",
      "phoneNumber",
      "email",
    ];
  }
  return ["paypalEmail", "confirmPaypalEmail", "country", "phoneNumber", "preferredCurrency"];
}

function paymentDetailsFor(
  method: CheckoutMethod,
  form: Record<string, string>,
  brand: "Visa" | "Mastercard" | "Card"
): Record<string, unknown> {
  if (method === "card") {
    return {
      cardholderName: form.cardholderName,
      billingZipCode: form.billingZipCode,
      country: form.country,
      phoneNumber: form.phoneNumber,
      email: form.email,
      cardBrand: form.cardBrand || brand,
      cardPaymentMethodId: form.cardPaymentMethodId,
    };
  }
  if (method === "paypal") {
    return {
      paypalEmail: form.paypalEmail,
      confirmPaypalEmail: form.confirmPaypalEmail,
      country: form.country,
      phoneNumber: form.phoneNumber,
      preferredCurrency: form.preferredCurrency,
    };
  }
  return {
    accountHolderName: form.accountHolderName,
    bankName: form.bankName,
    routingNumber: form.routingNumber,
    accountNumber: form.accountNumber,
    confirmAccountNumber: form.confirmAccountNumber,
    accountLast4: form.accountNumber.slice(-4),
    accountType: form.accountType,
    country: form.country,
    address: form.address,
    city: form.city,
    state: form.state,
    zipCode: form.zipCode,
    phoneNumber: form.phoneNumber,
    email: form.email,
  };
}

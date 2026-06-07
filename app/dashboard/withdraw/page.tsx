import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CreditCard,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { APP_NAME, PAYOUT_METHOD_LABELS } from "@/lib/constants";
import { getWithdrawalCheckoutContext } from "@/lib/withdrawal-page";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WithdrawalBlockedCheckout } from "@/components/dashboard/WithdrawalCheckoutScreens";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Withdraw Funds · ${APP_NAME}`,
};

const methods = [
  {
    href: "/dashboard/withdraw/bank",
    label: PAYOUT_METHOD_LABELS.bank_transfer,
    description: "Send funds directly to your verified bank account.",
    icon: Banknote,
    badge: "Recommended",
  },
  {
    href: "/dashboard/withdraw/card",
    label: PAYOUT_METHOD_LABELS.card,
    description: "Transfer to an eligible Visa or Mastercard debit card where supported.",
    icon: CreditCard,
    badge: "Fast",
  },
  {
    href: "/dashboard/withdraw/paypal",
    label: PAYOUT_METHOD_LABELS.paypal,
    description: "Transfer using a connected PayPal account.",
    icon: Mail,
    badge: "External Provider",
  },
];

export default async function DashboardWithdrawPage({
  searchParams,
}: {
  searchParams?: { caseId?: string };
}) {
  const context = await getWithdrawalCheckoutContext(searchParams?.caseId);
  if ("blocked" in context) {
    return <WithdrawalBlockedCheckout {...context} />;
  }

  const query = searchParams?.caseId ? `?caseId=${searchParams.caseId}` : "";

  return (
    <main className="min-h-[calc(100vh-2rem)] bg-[#001b2c] px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] text-white lg:pb-8">
      <div className="mx-auto w-full max-w-[430px] space-y-4 overflow-hidden rounded-[34px] border border-white/15 bg-[#041122]/95 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between px-4 pt-1 text-sm font-semibold">
          <span>9:41</span>
          <span className="h-2.5 w-5 rounded-sm border border-white/80" />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-full border-white/10 bg-white/[0.08]">
            <Link href="/dashboard/escrow">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-slate-200">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <header className="pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
            Secure payout
          </p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.02em]">
            Withdraw Funds
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Select a verified withdrawal method for escrow case{" "}
            <span className="font-semibold text-white">{context.operation.case_number}</span>.
          </p>
        </header>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.065] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Available Balance
          </p>
          <p className="mt-2 text-4xl font-semibold">
            {formatCurrency(context.availableAmount, context.escrow.currency)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Secure payouts are scheduled after release processing requirements
            have been completed and verified.
          </p>
        </section>

        <div className="space-y-3">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <Link
                key={method.href}
                href={`${method.href}${query}`}
                className="group flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.055] p-4 transition hover:border-blue-300/30 hover:bg-blue-400/[0.08]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-white">{method.label}</span>
                    <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                      {method.badge}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                    {method.description}
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-white" aria-hidden="true" />
              </Link>
            );
          })}
        </div>

        <div className="mx-auto h-1.5 w-32 rounded-full bg-white" />
      </div>
    </main>
  );
}

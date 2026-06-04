import Image from "next/image";
import { CreditCard, Landmark } from "lucide-react";

import { SUPPORTED_PAYOUT_METHODS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function PayoutMethodStrip({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-xl shadow-black/10 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Withdrawal methods
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorized payout rails for eligible escrow withdrawals.
          </p>
        </div>
        <CardBrandMarks />
      </div>

      <div
        className={cn(
          "mt-4 grid gap-2",
          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"
        )}
      >
        {SUPPORTED_PAYOUT_METHODS.map((method) => (
          <div
            key={method.method}
            className="rounded-xl border border-white/10 bg-background/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {method.label}
              </span>
              {method.method === "bank_transfer" ? (
                <Landmark className="h-4 w-4 text-primary" />
              ) : method.method === "card" ? (
                <CreditCard className="h-4 w-4 text-primary" />
              ) : (
                <PayPalWordmark />
              )}
            </div>
            {!compact ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {method.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PayPalWordmark() {
  return (
    <span className="text-sm font-bold italic tracking-tight text-[#179BD7]">
      PayPal
    </span>
  );
}

function CardBrandMarks() {
  return (
    <div
      className="relative h-10 w-40 overflow-hidden rounded-xl border border-white/15 bg-white p-1.5 shadow-lg shadow-black/15"
      aria-label="Supported card brands"
    >
      <Image
        src="/trust-badges/stripe-payments.jpeg"
        alt="Powered by Stripe with Visa, Mastercard, Maestro, American Express, and Discover card brands"
        width={500}
        height={125}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export default PayoutMethodStrip;

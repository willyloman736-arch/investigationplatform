"use client";

import * as React from "react";
import { CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STRIPE_SCRIPT_SRC = "https://js.stripe.com/v3/";
const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

type StripeCardElement = {
  mount: (element: HTMLElement) => void;
  unmount: () => void;
  on: (
    event: "change",
    handler: (event: { brand?: string; error?: { message?: string } }) => void
  ) => void;
};

type StripeElements = {
  create: (
    type: "card",
    options?: Record<string, unknown>
  ) => StripeCardElement;
};

type StripeInstance = {
  elements: (options?: Record<string, unknown>) => StripeElements;
  confirmCardSetup: (
    clientSecret: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<{
    error?: { message?: string };
    setupIntent?: { payment_method?: string | { id?: string } | null };
  }>;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance | null;
  }
}

let stripeScriptPromise: Promise<void> | null = null;

function loadStripeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Stripe) return Promise.resolve();

  stripeScriptPromise ??= new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${STRIPE_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Stripe.js failed to load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = STRIPE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Stripe.js failed to load."));
    document.head.appendChild(script);
  });

  return stripeScriptPromise;
}

function paymentMethodIdFrom(value: string | { id?: string } | null | undefined) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id ?? "";
}

export function StripeCardSetup({
  caseId,
  cardholderName,
  postalCode,
  paymentMethodId,
  onPaymentMethodId,
  onBrand,
}: {
  caseId: string;
  cardholderName: string;
  postalCode: string;
  paymentMethodId: string;
  onPaymentMethodId: (paymentMethodId: string) => void;
  onBrand?: (brand: "Visa" | "Mastercard" | "Card") => void;
}) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const stripeRef = React.useRef<StripeInstance | null>(null);
  const cardRef = React.useRef<StripeCardElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function mountCardElement() {
      if (!STRIPE_PUBLISHABLE_KEY) {
        setError("Card payout provider is not configured.");
        return;
      }

      try {
        await loadStripeScript();
        if (cancelled || !mountRef.current) return;

        const stripe = window.Stripe?.(STRIPE_PUBLISHABLE_KEY) ?? null;
        if (!stripe) {
          setError("Stripe Elements could not initialize.");
          return;
        }

        const elements = stripe.elements();
        const card = elements.create("card", {
          style: {
            base: {
              color: "#f8fafc",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: "16px",
              "::placeholder": { color: "rgba(148, 163, 184, 0.86)" },
              iconColor: "#60a5fa",
            },
            invalid: {
              color: "#f87171",
              iconColor: "#f87171",
            },
          },
        });
        card.on("change", (event) => {
          if (event.error?.message) setError(event.error.message);
          if (event.brand === "visa") onBrand?.("Visa");
          else if (event.brand === "mastercard") onBrand?.("Mastercard");
          else if (event.brand) onBrand?.("Card");
        });
        card.mount(mountRef.current);
        stripeRef.current = stripe;
        cardRef.current = card;
        setReady(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Stripe.js failed to load.");
      }
    }

    void mountCardElement();

    return () => {
      cancelled = true;
      cardRef.current?.unmount();
      cardRef.current = null;
      stripeRef.current = null;
      setReady(false);
    };
  }, []);

  async function confirmCard() {
    if (!stripeRef.current || !cardRef.current) return;
    if (!cardholderName.trim()) {
      setError("Enter the cardholder name before securing the card.");
      return;
    }
    if (!postalCode.trim()) {
      setError("Enter the billing ZIP or postal code before securing the card.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const payload = (await response.json()) as {
        clientSecret?: string;
        error?: string;
      };
      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.error ?? "Could not initialize card setup.");
      }

      const result = await stripeRef.current.confirmCardSetup(
        payload.clientSecret,
        {
          payment_method: {
            card: cardRef.current,
            billing_details: {
              name: cardholderName.trim(),
              address: { postal_code: postalCode.trim() },
            },
          },
        },
        { redirect: "if_required" }
      );

      if (result.error) {
        throw new Error(result.error.message ?? "Card setup was not completed.");
      }

      const id = paymentMethodIdFrom(result.setupIntent?.payment_method);
      if (!id) {
        throw new Error("Stripe did not return a payment method reference.");
      }
      onPaymentMethodId(id);
    } catch (err) {
      onPaymentMethodId("");
      setError(err instanceof Error ? err.message : "Card setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.07] p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Card details are collected by Stripe Elements
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Card number, expiry, and CVC never touch this form or database.
          </p>
        </div>
      </div>

      <div
        ref={mountRef}
        className={cn(
          "mt-4 min-h-12 rounded-xl border border-white/10 bg-background/45 px-3 py-3",
          !ready && "border-dashed"
        )}
      />

      {!ready && !error ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Loading secure card field...
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs font-medium text-destructive">{error}</p>
      ) : null}

      <Button
        type="button"
        variant={paymentMethodId ? "outline" : "default"}
        onClick={confirmCard}
        disabled={!ready || loading || !STRIPE_PUBLISHABLE_KEY}
        className="mt-4 h-12 w-full rounded-xl"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : paymentMethodId ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        )}
        {paymentMethodId ? "Card secured with Stripe" : "Secure Card with Stripe"}
      </Button>
    </div>
  );
}

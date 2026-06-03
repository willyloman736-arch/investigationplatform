import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { OperatorForm } from "./operator-form";
import { APP_NAME, APP_TAGLINE, DEMO_MODE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Operator sign-in · ${APP_NAME}`,
  description: `Restricted operator console for ${APP_NAME} staff.`,
  robots: { index: false, follow: false },
};

/**
 * Operator (admin) sign-in — a focused, centered "operations" console for DAI
 * staff. Its own minimal layout (centered card + brand emblem) rather than the
 * split client-auth layout. Branded entirely as Digital Asset Investigations —
 * no third-party or government identity. Same Supabase auth; routes to /admin.
 */
export default function OperatorLoginPage() {
  return (
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden px-5 py-12">
      {/* Ambient background (decorative) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-background"
      >
        <div className="absolute left-1/2 top-[-12%] h-[420px] w-[min(680px,92vw)] -translate-x-1/2 rounded-full bg-primary/12 blur-[120px]" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
      </div>

      {/* Brand emblem */}
      <Logo variant="icon" size="lg" className="mb-6" />

      {/* Operator card */}
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Operator console
        </p>

        <div className="mb-6 mt-2 space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in to <span className="text-primary">operations</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Restricted access for authorized {APP_NAME} operators.
          </p>
        </div>

        {DEMO_MODE ? (
          <div
            role="status"
            className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200"
          >
            <span className="font-medium">Demo Mode is on.</span> Any credentials
            open the admin command center.
          </div>
        ) : null}

        <OperatorForm />

        <div className="mt-6 space-y-2 border-t border-white/10 pt-5 text-center">
          <p className="text-sm text-muted-foreground">
            Need operator access? Contact your administrator.
          </p>
          <p className="text-sm text-muted-foreground">
            Client or invited operator?{" "}
            <Link
              href="/login"
              className="font-medium text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Use the client portal
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-md text-center text-xs leading-relaxed text-muted-foreground/70">
        Authorized personnel only. Sign-in events are recorded in the audit log.
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground/60">
        {APP_TAGLINE}
      </p>
    </main>
  );
}

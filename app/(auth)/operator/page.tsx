import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { OperatorForm } from "./operator-form";
import { APP_NAME, DEMO_MODE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Operator sign-in · ${APP_NAME}`,
  description: `Restricted operator console for ${APP_NAME} staff.`,
  robots: { index: false, follow: false },
};

/**
 * Operator (admin) sign-in — a branded "operations" console entry for DAI staff.
 * Same Supabase auth as the client portal; routes to /admin on success. No
 * third-party or government branding — this is Digital Asset Investigations' own
 * console.
 */
export default function OperatorLoginPage() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md sm:p-8">
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

      <div className="mt-6 border-t border-white/10 pt-5 text-center">
        <p className="text-sm text-muted-foreground">
          Client or counterparty?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Use the client portal
          </Link>
        </p>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground/70">
        Authorized personnel only. Sign-in events are recorded in the audit log.
      </p>
    </div>
  );
}

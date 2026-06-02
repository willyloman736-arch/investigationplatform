import type { Metadata } from "next";
import Link from "next/link";

import { RecoverForm } from "./recover-form";
import { DEMO_MODE, APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Recover account · ${APP_NAME}`,
  description: `Regain access to your ${APP_NAME} account using your recovery phrase.`,
};

export default function RecoverPage() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Recover your account
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and the 12-word recovery phrase you saved at signup to
          set a new password.
        </p>
      </div>

      {DEMO_MODE ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200"
        >
          <span className="font-medium">Demo Mode is on.</span> Recovery needs a
          real Supabase project, so it is disabled here.
        </div>
      ) : null}

      <RecoverForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-emerald-400 underline-offset-4 transition-colors hover:text-emerald-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Back to sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground/70">
        Your recovery phrase is never stored in readable form. {APP_NAME} staff
        cannot see it and will never ask for it.
      </p>
    </div>
  );
}

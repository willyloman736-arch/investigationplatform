import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./register-form";
import { DEMO_MODE, APP_NAME, PROVIDER_DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Create account · ${APP_NAME}`,
  description: `Create an ${APP_NAME} account to open cases, fund escrow, and exchange evidence securely.`,
};

export default function RegisterPage() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Create your account
        </h2>
        <p className="text-sm text-muted-foreground">
          Open cases, fund escrow, and exchange evidence with confidence.
        </p>
      </div>

      {DEMO_MODE ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200"
        >
          <span className="font-medium">Demo Mode is on.</span> No account is
          created — submit to explore the dashboard. Disable in production.
        </div>
      ) : null}

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground/70">
        By creating an account you agree to use {APP_NAME} for lawful purposes.{" "}
        {PROVIDER_DISCLAIMER}
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";
import { AuthCard } from "@/components/auth/AuthCard";
import { Logo } from "@/components/shared/Logo";
import { DEMO_MODE, APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Sign in · ${APP_NAME}`,
  description: `Sign in to your ${APP_NAME} account to manage recovery complaints, KYC, escrow, and withdrawal requests.`,
};

export default function LoginPage() {
  return (
    <AuthCard>
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4">
          <Logo href={null} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to your recovery &amp; escrow account.
        </p>
      </div>

      {DEMO_MODE ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200"
        >
          <span className="font-medium">Demo Mode is on.</span> Authentication is
          bypassed — submit with any details to explore the dashboard. Disable in
          production.
        </div>
      ) : null}

      <LoginForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to {APP_NAME}?{" "}
        <Link
          href="/register"
          className="font-medium text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Create an account
        </Link>
      </p>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground/70">
        Clients and operators share this sign-in.{" "}
        <Link
          href="/operator"
          className="font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Operator sign-in →
        </Link>
      </p>
    </AuthCard>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, FileSearch, IdCard } from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { APP_NAME, APP_TAGLINE, PROVIDER_DISCLAIMER } from "@/lib/constants";

/**
 * Auth shell: a centered split layout.
 *  - Left  (lg+): brand / trust panel with subtle glassmorphism.
 *  - Right (all): the form panel (login / register) on a glass card.
 *
 * Dark theme is inherited from the root <html className="dark"> in app/layout.
 */

const TRUST_POINTS = [
  {
    icon: Lock,
    title: "Recovered funds escrow",
    body: "Recovered balances are entered by admins and reflected in escrow while real payouts stay protected server-side.",
  },
  {
    icon: FileSearch,
    title: "Evidence-backed complaints",
    body: "Upload receipts, wallet addresses, transaction hashes, screenshots, and chat logs to a structured case file.",
  },
  {
    icon: IdCard,
    title: "KYC before withdrawal",
    body: "Government ID, selfie, proof of address, phone, and email checks are reviewed before payout approval.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-screen w-full grid-cols-1 overflow-hidden lg:grid-cols-2">
      {/* Ambient background glow (decorative). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background"
      >
        <div className="absolute -left-32 top-[-10%] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Left: brand / trust panel */}
      <aside className="relative hidden flex-col justify-between border-r border-white/10 bg-white/[0.02] p-10 backdrop-blur-md lg:flex xl:p-14">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/how-it-works"
            className="rounded-md px-2 py-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            How it works
          </Link>
        </div>

        <div className="max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Crypto Scam Recovery &amp; Secure Escrow
          </div>
          <h1 className="text-balance text-3xl font-semibold leading-tight text-foreground xl:text-4xl">
            Recovery, structured.
          </h1>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
            {APP_NAME} helps clients file crypto scam complaints, complete KYC,
            track admin review, and monitor recovered funds in escrow.
          </p>

          <ul className="mt-10 space-y-6">
            {TRUST_POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="max-w-md text-xs leading-relaxed text-muted-foreground/80">
          {PROVIDER_DISCLAIMER}
        </p>
      </aside>

      {/* Right: form panel */}
      <section className="flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        {/* Mobile-only top brand (left panel is hidden < lg). */}
        <div className="mb-8 flex w-full max-w-md items-center justify-between lg:hidden">
          <Logo />
          <Link
            href="/how-it-works"
            className="rounded-md px-2 py-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            How it works
          </Link>
        </div>

        <div className="w-full max-w-md">{children}</div>

        <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-muted-foreground/70 lg:hidden">
          {PROVIDER_DISCLAIMER}
        </p>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          {APP_TAGLINE}
        </p>
      </section>
    </main>
  );
}

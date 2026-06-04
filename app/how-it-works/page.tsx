import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { EscrowStatus } from "@/lib/types";
import { ESCROW_STATUS_CONFIG, PROVIDER_DISCLAIMER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EscrowStatusBadge } from "@/components/shared/EscrowStatusBadge";
import { Navbar } from "@/components/marketing/Navbar";
import { HowItWorksSteps } from "@/components/marketing/HowItWorksSteps";
import { TrustBanner } from "@/components/marketing/TrustBanner";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "How recovery escrow works — Digital Asset Investigations",
  description:
    "A transparent walkthrough of the Digital Asset Investigations recovery lifecycle: complaint review, KYC, recovered-funds escrow, authorized withdrawal review, and escrow status meanings.",
};

/**
 * The order escrow states move through during a healthy case, used to render the
 * status legend. ESCROW_STATUS_CONFIG remains the single source of truth for the
 * label, colors, and description of each status.
 */
const STATUS_ORDER: EscrowStatus[] = [
  "pending_deposit",
  "securely_escrowed",
  "ready_for_release",
  "under_dispute_audit",
  "release_frozen",
  "released",
];

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* Page hero */}
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
            <div className="absolute left-1/2 top-[-10%] h-80 w-[min(720px,90vw)] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
          </div>

          <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:px-8">
            <SectionHeading
              eyebrow="Transparency"
              title="How recovery escrow works on Digital Asset Investigations"
              subtitle="No black boxes. Here is how complaints are reviewed, KYC is checked, recovered funds are reflected in escrow, and withdrawal eligibility is authorized."
            />
          </div>
        </section>

        {/* Full 4-step workflow */}
        <section
          id="workflow"
          className="scroll-mt-20 pb-16 pt-4 sm:pb-20"
          aria-label="Escrow workflow steps"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <HowItWorksSteps variant="full" />
          </div>
        </section>

        {/* Escrow status legend */}
        <section
          id="statuses"
          className="scroll-mt-20 py-16 sm:py-20"
          aria-label="Escrow status reference"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Escrow status reference"
              title="What each escrow status means"
              subtitle="Every recovery case displays an escrow status so the client knows whether recovered funds are pending, secured, frozen, eligible, or paid."
            />

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STATUS_ORDER.map((status) => (
                <div
                  key={status}
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
                >
                  <EscrowStatusBadge status={status} />
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {ESCROW_STATUS_CONFIG[status].description}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground/80">
              {PROVIDER_DISCLAIMER}
            </p>
          </div>
        </section>

        {/* Release rules */}
        <section
          id="security"
          className="scroll-mt-20 pb-4"
          aria-label="Release rules"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md sm:p-12">
              <SectionHeading
                align="left"
                eyebrow="The rule that protects everyone"
                title="Withdrawal opens only after release authorization"
                subtitle="Eligibility and provider actions are handled through protected server-side workflows. Money is never moved directly from the browser."
              />
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <h3 className="text-sm font-semibold text-emerald-300">
                    Path 1 - KYC and conditions cleared
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    When KYC is verified and all custom withdrawal conditions are
                    cleared, the case moves to final release review before escrow is marked{" "}
                    <span className="font-medium text-foreground">
                      Ready for Release
                    </span>
                    . The review reason is recorded, required receipts are
                    generated, and payout is requested only through protected
                    provider workflow.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
                  <h3 className="text-sm font-semibold text-blue-300">
                    Path 2 - Resolved dispute or verification hold
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    If a dispute, KYC hold, or suspicious activity flag is raised,
                    release is frozen while evidence is reviewed. Only a
                    documented resolution can make the escrow eligible again.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-xs leading-relaxed text-muted-foreground/80">
                Funds are marked paid or released only after server-side provider
                or internal confirmation. {PROVIDER_DISCLAIMER}
              </p>
            </div>
          </div>
        </section>

        {/* Trust badges */}
        <section className="py-16 sm:py-20">
          <TrustBanner />
        </section>

        {/* CTA */}
        <section className="pb-20" aria-label="Get started">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/10 to-background px-6 py-14 text-center sm:px-12">
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Ready to open your recovery complaint?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
                Submit your complaint for free review, complete KYC, and track
                recovered funds in a secure escrow account.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/register">
                    Open Recovery Case
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full border-white/15 bg-white/5 hover:bg-white/10 sm:w-auto"
                >
                  <Link href="/login">Log in to the portal</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

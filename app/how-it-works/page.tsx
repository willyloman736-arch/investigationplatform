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
  title: "How escrow works — AEGIS",
  description:
    "A transparent walkthrough of the AEGIS escrow lifecycle: contract setup, funding, verification, and mutual release — plus what every escrow status means.",
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
              title="How escrow works on AEGIS"
              subtitle="No black boxes. Here is exactly how funds are protected, how evidence is handled, and the conditions that must be met before money is ever released."
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
              subtitle="Every case displays one of these statuses at all times, so both parties always know precisely where the funds stand."
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
                title="Funds release only after verified approval — or a resolved dispute"
                subtitle="There are exactly two paths to a release, and an administrator can never move funds directly from the interface."
              />
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <h3 className="text-sm font-semibold text-emerald-300">
                    Path 1 — Mutual approval
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    When both Party A and Party B approve the outcome, the escrow
                    becomes eligible for release and moves to{" "}
                    <span className="font-medium text-foreground">
                      Ready for Release
                    </span>
                    . The release is then requested through the licensed partner.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
                  <h3 className="text-sm font-semibold text-blue-300">
                    Path 2 — Resolved dispute
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    If a dispute is raised, release is frozen while an admin
                    reviews the evidence. Only a documented resolution can make
                    the escrow eligible again, with the reason recorded to the
                    audit trail.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-xs leading-relaxed text-muted-foreground/80">
                Funds are marked released only after the licensed payment/escrow
                partner confirms. {PROVIDER_DISCLAIMER}
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
                Ready to open your first secured case?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
                Set up a contract, fund escrow through a licensed partner, and
                release only after verified approval.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/register">
                    Start an Investigation / Project
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

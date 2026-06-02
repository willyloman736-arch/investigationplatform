import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { getStats } from "@/lib/data";
import { PROVIDER_DISCLAIMER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Navbar } from "@/components/marketing/Navbar";
import { CryptoTicker } from "@/components/marketing/CryptoTicker";
import { HeroSection } from "@/components/marketing/HeroSection";
import { TrustBanner } from "@/components/marketing/TrustBanner";
import { StatsCounter } from "@/components/marketing/StatsCounter";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HowItWorksSteps } from "@/components/marketing/HowItWorksSteps";
import { Footer } from "@/components/marketing/Footer";

/**
 * Public landing page (Server Component).
 * Headline metrics come from getStats() so they can later be sourced from
 * Supabase without changing the marketing components.
 */
export default async function LandingPage() {
  const stats = await getStats();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {/* Live crypto market ticker — TradingView free widget */}
      <CryptoTicker />

      <main className="flex-1">
        {/* Hero */}
        <HeroSection />

        {/* Trust badges + disclaimer */}
        <div className="mt-4 sm:mt-0">
          <TrustBanner />
        </div>

        {/* Headline metrics */}
        <section className="py-16 sm:py-20" aria-label="Platform at a glance">
          <StatsCounter
            totalTransactedPool={stats.totalTransactedPool}
            activeDisputesResolved={stats.activeDisputesResolved}
            activeEscrowContracts={stats.activeEscrowContracts}
            currency={stats.currency}
          />
        </section>

        {/* Features */}
        <section
          id="product"
          className="scroll-mt-20 py-16 sm:py-20"
          aria-label="Product capabilities"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Built for high-trust deals"
              title="Everything a secured transaction needs"
              subtitle="From the first signature to the final release, Digital Asset Investigations keeps funds protected, evidence organized, and every action on the record."
            />
            <div className="mt-12">
              <FeatureGrid />
            </div>
          </div>
        </section>

        {/* How it works teaser */}
        <section
          id="how-it-works"
          className="scroll-mt-20 py-16 sm:py-20"
          aria-label="How it works"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="How it works"
              title="Four steps from agreement to release"
              subtitle="A transparent escrow lifecycle. Funds stay protected until both parties agree — or a dispute is resolved."
            />
            <div className="mt-12">
              <HowItWorksSteps variant="compact" />
            </div>
            <div className="mt-10 flex justify-center">
              <Button asChild variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10">
                <Link href="/how-it-works">
                  See the full escrow workflow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Security strip */}
        <section
          id="security"
          className="scroll-mt-20 py-16 sm:py-20"
          aria-label="Security and trust"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md sm:p-12">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <SectionHeading
                    align="left"
                    eyebrow="Security & trust"
                    title="Designed to be defensible, not just slick"
                    subtitle="Digital Asset Investigations does not custody funds and makes no claims it cannot back. Transport is encrypted over SSL, access is scoped per case, and every meaningful action is written to an append-only audit trail."
                  />
                  <p className="mt-6 text-xs leading-relaxed text-muted-foreground/80">
                    {PROVIDER_DISCLAIMER}
                  </p>
                </div>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: "Per-case access",
                      body: "Clients and counterparties see only the cases they belong to. Admins oversee disputes and escrow controls.",
                    },
                    {
                      title: "No unilateral releases",
                      body: "Release requires mutual approval or an admin dispute resolution. Admins can never move funds from the UI.",
                    },
                    {
                      title: "Evidence audit trail",
                      body: "Uploads, messages, approvals, and status changes are recorded so outcomes can be verified later.",
                    },
                    {
                      title: "Licensed partners",
                      body: "Money is deposited, held, and released only through licensed payment/escrow partners where available.",
                    },
                  ].map((card) => (
                    <li
                      key={card.title}
                      className="rounded-2xl border border-white/10 bg-background/40 p-5"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                        <h3 className="text-sm font-semibold text-foreground">
                          {card.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {card.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-24" aria-label="Get started">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/10 to-background px-6 py-14 text-center sm:px-12 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[min(680px,90%)] -translate-x-1/2 rounded-full bg-primary/20 blur-[110px]"
              />
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Secure your next high-trust transaction with Digital Asset Investigations
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
                Open a case, fund escrow through a licensed partner, and release
                funds only after verified mutual approval.
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
                  <Link href="/register">Open Secure Escrow</Link>
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

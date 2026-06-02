"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Lock, FileSearch, Scale } from "lucide-react";
import { motion, type Variants } from "framer-motion";

import { Button } from "@/components/ui/button";

const MICRO_BADGES = [
  { label: "Escrow-protected funds", icon: ShieldCheck },
  { label: "Transport-encrypted (SSL)", icon: Lock },
  { label: "Full evidence audit trail", icon: FileSearch },
  { label: "Mutual-approval release", icon: Scale },
];

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

/**
 * Landing hero. Headline copy is fixed per the product brief. The background
 * layers an animated emerald gradient glow over a subtle grid; all decorative
 * and pointer-events-none so it never blocks interaction or causes overflow.
 */
export function HeroSection() {
  return (
    <section className="relative isolate w-full overflow-hidden">
      {/* Decorative background */}
      <HeroBackground />

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-24 lg:pt-28">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl text-center"
        >
          {/* Eyebrow pill */}
          <motion.div variants={item} className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md">
              <span className="flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Secure escrow &amp; investigation management
            </span>
          </motion.div>

          {/* EXACT headline */}
          <motion.h1
            variants={item}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Secure Escrow &amp; Investigation Management for High-Trust Digital
            Transactions
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={item}
            className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Open investigation projects, secure funds in escrow, upload and
            verify evidence, and manage disputes in one place. Funds are released
            only after verified mutual approval — or an admin&apos;s dispute
            resolution.
          </motion.p>

          {/* Primary CTAs */}
          <motion.div
            variants={item}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
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
              className="w-full border-white/15 bg-white/5 backdrop-blur-md hover:bg-white/10 sm:w-auto"
            >
              <Link href="/register">Open Secure Escrow</Link>
            </Button>
          </motion.div>

          {/* Trust micro-badges */}
          <motion.ul
            variants={item}
            className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-3"
          >
            {MICRO_BADGES.map((badge) => {
              const Icon = badge.icon;
              return (
                <li
                  key={badge.label}
                  className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {badge.label}
                </li>
              );
            })}
          </motion.ul>
        </motion.div>
      </div>
    </section>
  );
}

/** Layered, animated, purely-decorative hero backdrop. */
function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />

      {/* Animated emerald glow */}
      <motion.div
        initial={{ opacity: 0.5, scale: 0.95 }}
        animate={{ opacity: [0.45, 0.7, 0.45], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 top-[-10%] h-[420px] w-[min(760px,90vw)] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />

      {/* Secondary blue glow for depth */}
      <motion.div
        initial={{ opacity: 0.3 }}
        animate={{ opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute right-[-10%] top-[20%] h-[320px] w-[min(520px,80vw)] rounded-full bg-blue-500/10 blur-[120px]"
      />

      {/* Bottom fade into page background */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}

export default HeroSection;

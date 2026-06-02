"use client";

import { useEffect, useRef, useState } from "react";
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
 * Landing hero. Headline copy is fixed per the product brief. Content is
 * left-aligned so the cinematic background video stays visible on the right.
 * The overlay is left-biased (dark behind the text, clearing toward the video)
 * and honors prefers-reduced-motion (poster only).
 */
export function HeroSection() {
  return (
    <section className="relative isolate w-full overflow-hidden">
      {/* Decorative background (video + overlays) */}
      <HeroBackground />

      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pb-32 lg:pt-36">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-xl text-left sm:max-w-2xl"
        >
          {/* Eyebrow pill */}
          <motion.div variants={item} className="flex justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Secure escrow &amp; investigation management
            </span>
          </motion.div>

          {/* EXACT headline */}
          <motion.h1
            variants={item}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Secure Escrow &amp; Investigation Management for High-Trust Digital
            Transactions
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Open investigation projects, secure funds in escrow, upload and
            verify evidence, and manage disputes in one place. Funds are released
            only after verified mutual approval — or an admin&apos;s dispute
            resolution.
          </motion.p>

          {/* Primary CTAs */}
          <motion.div
            variants={item}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-start"
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
            className="mt-10 flex max-w-2xl flex-wrap items-center justify-start gap-x-5 gap-y-3"
          >
            {MICRO_BADGES.map((badge) => {
              const Icon = badge.icon;
              return (
                <li
                  key={badge.label}
                  className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
                >
                  <Icon
                    className="h-3.5 w-3.5 text-cyan-300"
                    aria-hidden="true"
                  />
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

/** Muted, looping cinematic hero video. Falls back to the poster image when the
 *  user prefers reduced motion. */
function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  // Force muted + kick off playback imperatively. Browsers only autoplay MUTED
  // video, and React doesn't reliably reflect the `muted` attribute on hydration
  // (a long-standing bug), which silently blocks autoplay. Setting it on the
  // element and calling play() is the reliable fix.
  useEffect(() => {
    if (reducedMotion) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    tryPlay();
    // Retry when the first frames are ready (covers slow first paint / preload)
    // and when the tab becomes visible (covers being opened in a background tab).
    v.addEventListener("loadeddata", tryPlay, { once: true });
    v.addEventListener("canplay", tryPlay, { once: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      v.removeEventListener("loadeddata", tryPlay);
      v.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero/cinematic-hero-poster.jpg')" }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/hero/cinematic-hero-poster.jpg"
      aria-hidden="true"
    >
      <source src="/hero/cinematic-hero.mp4" type="video/mp4" />
    </video>
  );
}

/** Layered, animated, purely-decorative hero backdrop. */
function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Cinematic video (bottom layer, full brightness) */}
      <HeroVideo />

      {/* Light base darken — a little stronger on mobile for text legibility,
          minimal on desktop so the video reads clearly. */}
      <div className="absolute inset-0 bg-background/40 sm:bg-background/15" />

      {/* Left-biased readability gradient: dark behind the text, clearing to the
          right so the video shows through. */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/45 to-transparent" />

      {/* Gentle bottom fade into the page background */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

      {/* Subtle grid texture (kept light) */}
      <div className="absolute inset-0 opacity-50 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_30%_30%,black,transparent)]" />

      {/* Cyber-blue glow behind the headline (top-left) */}
      <motion.div
        initial={{ opacity: 0.4, scale: 0.95 }}
        animate={{ opacity: [0.32, 0.5, 0.32], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[2%] top-[-15%] h-[420px] w-[min(620px,80vw)] rounded-full bg-primary/20 blur-[120px]"
      />

      {/* Secondary ice-cyan glow on the right for depth */}
      <motion.div
        initial={{ opacity: 0.25 }}
        animate={{ opacity: [0.18, 0.32, 0.18] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute right-[-8%] top-[12%] h-[320px] w-[min(520px,70vw)] rounded-full bg-cyan-400/12 blur-[120px]"
      />
    </div>
  );
}

export default HeroSection;

import type { ReactNode } from "react";
import { Quicksand } from "next/font/google";

import { PROVIDER_DISCLAIMER } from "@/lib/constants";
import { ParticleNetwork } from "@/components/auth/ParticleNetwork";

/**
 * Auth shell — a single frosted-glass card centered on a "cyber teal" stage: a
 * near-black field lit by teal/cyan glows with a drifting particle-network
 * (constellation) canvas behind the card.
 *
 * The theme is scoped here via `.auth-theme` (overrides --primary / --ring for
 * the auth subtree only); the dashboard + admin keep their blue/ice palette. The
 * rounded display font is likewise scoped to auth headings.
 */

const display = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className={`auth-theme ${display.variable} relative grid min-h-svh w-full place-items-center px-4 py-10`}
    >
      {/* Cyber-teal stage (decorative): near-black mesh + drifting glows +
          particle network + grain. */}
      <div
        aria-hidden
        className="auth-silk pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="auth-aurora-drift absolute -left-24 top-[-14%] h-[540px] w-[540px] rounded-full bg-blue-500/14 blur-[140px]" />
        <div className="auth-aurora-drift absolute right-[-12%] top-[30%] h-[500px] w-[500px] rounded-full bg-sky-500/14 blur-[140px] [animation-delay:-9s]" />
        <div className="absolute bottom-[-18%] left-[30%] h-[420px] w-[420px] rounded-full bg-blue-400/8 blur-[130px]" />
        <ParticleNetwork className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 auth-grain" />
        <div className="absolute inset-0 auth-vignette" />
      </div>

      <div className="w-full max-w-md space-y-5">
        {children}
        <p className="text-center text-[11px] leading-relaxed text-white/45">
          {PROVIDER_DISCLAIMER}
        </p>
      </div>
    </main>
  );
}

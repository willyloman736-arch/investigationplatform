import type { ReactNode } from "react";
import { Quicksand } from "next/font/google";

import { PROVIDER_DISCLAIMER } from "@/lib/constants";

/**
 * Auth shell — a single frosted-glass card centered on a purple "silk" stage.
 *
 * Purple is scoped here via `.auth-purple` (overrides --primary / --ring for the
 * auth subtree only); the dashboard + admin keep their blue/ice palette. The
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
      className={`auth-purple ${display.variable} relative grid min-h-svh w-full place-items-center px-4 py-10`}
    >
      {/* Purple silk stage (decorative): gradient mesh + drifting glows + grain. */}
      <div
        aria-hidden
        className="auth-silk pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="auth-aurora-drift absolute -left-24 top-[-14%] h-[560px] w-[560px] rounded-full bg-fuchsia-500/30 blur-[130px]" />
        <div className="auth-aurora-drift absolute right-[-12%] top-[28%] h-[520px] w-[520px] rounded-full bg-violet-500/30 blur-[130px] [animation-delay:-9s]" />
        <div className="absolute bottom-[-18%] left-[30%] h-[420px] w-[420px] rounded-full bg-purple-400/20 blur-[120px]" />
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

import type { ReactNode } from "react";

import { PROVIDER_DISCLAIMER } from "@/lib/constants";

/**
 * Auth shell — a single frosted-glass card centered on a purple aurora stage.
 *
 * Purple is scoped here via `.auth-purple` (overrides --primary / --ring for the
 * auth subtree only); the dashboard + admin keep their blue/ice palette.
 *
 * Dark theme is inherited from the root <html className="dark"> in app/layout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-purple relative grid min-h-svh w-full place-items-center px-4 py-10">
      {/* Purple aurora stage (decorative). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        style={{ backgroundColor: "#0c0614" }}
      >
        <div className="auth-aurora-drift absolute -left-32 top-[-12%] h-[520px] w-[520px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="absolute bottom-[-18%] right-[-10%] h-[560px] w-[560px] rounded-full bg-fuchsia-600/25 blur-[130px]" />
        <div className="auth-aurora-drift absolute left-[40%] top-[36%] h-[360px] w-[360px] rounded-full bg-violet-500/25 blur-[120px] [animation-delay:-9s]" />
        <div className="absolute inset-0 auth-grid" />
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

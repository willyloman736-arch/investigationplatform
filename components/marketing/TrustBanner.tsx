import {
  LockKeyhole,
  MonitorCheck,
  BadgeCheck,
  ShieldCheck,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PROVIDER_DISCLAIMER } from "@/lib/constants";

interface TrustBadge {
  label: string;
  icon: LucideIcon;
}

/**
 * Honest trust badges, presented as an auto-scrolling strip. These describe
 * workflow guarantees the platform actually provides (transport security, a
 * secure client portal, an escrow workflow, an evidence audit trail) — no
 * fabricated certifications. The disclaimer keeps fund-movement copy accurate.
 *
 * The strip is a pure-CSS marquee: two identical tracks each translating -100%
 * for a seamless loop. It pauses on hover, fades at the edges, and stops for
 * users who prefer reduced motion.
 */
const BADGES: TrustBadge[] = [
  { label: "SSL Encrypted", icon: LockKeyhole },
  { label: "Secure Client Portal", icon: MonitorCheck },
  { label: "Verified Company Registration", icon: BadgeCheck },
  { label: "Escrow Workflow Protected", icon: ShieldCheck },
  { label: "Evidence Audit Trail", icon: ScrollText },
];

function BadgePill({ icon: Icon, label }: TrustBadge) {
  return (
    <li className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-2 pl-2 pr-4 backdrop-blur-md">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap text-sm font-medium text-foreground/90">
        {label}
      </span>
    </li>
  );
}

interface TrustBannerProps {
  className?: string;
}

export function TrustBanner({ className }: TrustBannerProps) {
  return (
    <section
      aria-label="Trust and compliance"
      className={cn("relative w-full", className)}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] py-4 backdrop-blur-md">
          {/* Auto-scrolling badge strip (pure-CSS marquee) */}
          <div className="group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]">
            <ul className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
              {BADGES.map((b) => (
                <BadgePill key={b.label} {...b} />
              ))}
            </ul>
            <ul
              aria-hidden="true"
              className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
            >
              {BADGES.map((b) => (
                <BadgePill key={`${b.label}-dup`} {...b} />
              ))}
            </ul>
          </div>

          <p className="mt-4 px-5 text-center text-xs leading-relaxed text-muted-foreground">
            {PROVIDER_DISCLAIMER}
          </p>
        </div>
      </div>
    </section>
  );
}

export default TrustBanner;

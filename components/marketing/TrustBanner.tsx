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

interface Item {
  label: string;
  icon: LucideIcon;
}

/**
 * Honest workflow trust badges, presented as an auto-scrolling strip under the
 * hero. They describe guarantees the platform actually provides (transport
 * security, a secure portal, an escrow workflow, an evidence audit trail) — no
 * fabricated certifications. The compliance-roadmap strip lives in the footer
 * (see components/marketing/ComplianceStrip.tsx) so the top doesn't feel busy.
 *
 * Pure-CSS marquee: two identical tracks each translating -100% for a seamless
 * loop. Pauses on hover, fades at the edges, stops for prefers-reduced-motion.
 */
const WORKFLOW: Item[] = [
  { label: "SSL Encrypted", icon: LockKeyhole },
  { label: "Secure Client Portal", icon: MonitorCheck },
  { label: "Verified Company Registration", icon: BadgeCheck },
  { label: "Escrow Workflow Protected", icon: ShieldCheck },
  { label: "Evidence Audit Trail", icon: ScrollText },
];

const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]";

function WorkflowPill({ icon: Icon, label }: Item) {
  return (
    <li className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 backdrop-blur-md">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
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
      aria-label="Trust and security"
      className={cn("relative w-full", className)}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] py-4 backdrop-blur-md">
          {/* Workflow trust badges — auto-scrolling */}
          <div className={cn("group relative flex overflow-hidden", EDGE_FADE)}>
            <ul className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
              {WORKFLOW.map((b) => (
                <WorkflowPill key={b.label} {...b} />
              ))}
            </ul>
            <ul
              aria-hidden="true"
              className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
            >
              {WORKFLOW.map((b) => (
                <WorkflowPill key={`${b.label}-dup`} {...b} />
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

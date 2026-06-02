import {
  LockKeyhole,
  MonitorCheck,
  BadgeCheck,
  ShieldCheck,
  ScrollText,
  Award,
  Fingerprint,
  FileCheck,
  Landmark,
  Globe,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PROVIDER_DISCLAIMER } from "@/lib/constants";

interface Item {
  label: string;
  icon: LucideIcon;
}

/** Honest workflow guarantees the platform actually provides. */
const WORKFLOW: Item[] = [
  { label: "SSL Encrypted", icon: LockKeyhole },
  { label: "Secure Client Portal", icon: MonitorCheck },
  { label: "Verified Company Registration", icon: BadgeCheck },
  { label: "Escrow Workflow Protected", icon: ShieldCheck },
  { label: "Evidence Audit Trail", icon: ScrollText },
];

/**
 * Certifications being PURSUED — shown as a roadmap, clearly marked "In progress".
 * These are NOT yet held. Do not relabel them "Certified"/"Compliant" until the
 * audits are actually completed — that would be false advertising.
 */
const COMPLIANCE: Item[] = [
  { label: "SOC 2 Type II", icon: ShieldCheck },
  { label: "ISO 27001", icon: Award },
  { label: "CJIS", icon: Fingerprint },
  { label: "NIST 800-53", icon: FileCheck },
  { label: "DFARS", icon: Landmark },
  { label: "GDPR", icon: Globe },
];

function WorkflowPill({ icon: Icon, label }: Item) {
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

function CompliancePill({ icon: Icon, label }: Item) {
  return (
    <li className="flex shrink-0 items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2">
      <Icon
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap text-xs font-semibold text-foreground/90">
          {label}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300/90">
          <span
            className="h-1 w-1 rounded-full bg-amber-400"
            aria-hidden="true"
          />
          In progress
        </span>
      </span>
    </li>
  );
}

const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]";

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
          {/* Workflow trust badges — auto-scrolling left */}
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

          {/* Compliance roadmap — certifications actively in progress (NOT held yet) */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-3 px-5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Compliance roadmap · certifications in progress
            </p>
            <div
              className={cn("group relative flex overflow-hidden", EDGE_FADE)}
            >
              <ul className="flex shrink-0 items-center gap-3 pr-3 animate-marquee-reverse group-hover:[animation-play-state:paused] motion-reduce:animate-none">
                {COMPLIANCE.map((b) => (
                  <CompliancePill key={b.label} {...b} />
                ))}
              </ul>
              <ul
                aria-hidden="true"
                className="flex shrink-0 items-center gap-3 pr-3 animate-marquee-reverse group-hover:[animation-play-state:paused] motion-reduce:animate-none"
              >
                {COMPLIANCE.map((b) => (
                  <CompliancePill key={`${b.label}-dup`} {...b} />
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-4 border-t border-white/10 px-5 pt-4 text-center text-xs leading-relaxed text-muted-foreground">
            {PROVIDER_DISCLAIMER} Compliance certifications shown are in progress
            and not yet completed.
          </p>
        </div>
      </div>
    </section>
  );
}

export default TrustBanner;

import {
  LockKeyhole,
  MonitorCheck,
  BadgeCheck,
  ShieldCheck,
  ScrollText,
  FileCheck,
  Medal,
  Fingerprint,
  ListChecks,
  Landmark,
  Scale,
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
 * These are NOT yet held. Do not swap in the official cert seals or relabel them
 * "Certified"/"Compliant" until the audit is actually completed — the real marks
 * are trademark-controlled and imply certification.
 */
const COMPLIANCE: Item[] = [
  { label: "SOC 2 Type II", icon: FileCheck },
  { label: "ISO 27001", icon: Medal },
  { label: "CJIS", icon: Fingerprint },
  { label: "NIST 800-53", icon: ListChecks },
  { label: "DFARS", icon: Landmark },
  { label: "GDPR", icon: Scale },
];

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

function CompliancePill({ icon: Icon, label }: Item) {
  return (
    <li className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 backdrop-blur-md">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/25">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap text-sm font-semibold text-foreground/90">
          {label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-300/90">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-amber-400/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
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

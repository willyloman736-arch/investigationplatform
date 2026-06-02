import {
  FileCheck,
  Medal,
  Fingerprint,
  ListChecks,
  Landmark,
  Scale,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface Item {
  label: string;
  icon: LucideIcon;
}

/**
 * Certifications being PURSUED — a roadmap, clearly marked "In progress". These
 * are NOT yet held. Do not swap in the official cert seals or relabel them
 * "Certified"/"Compliant" until the audit is actually completed.
 *
 * Rendered in the footer (kept out of the hero so the top doesn't feel crowded).
 */
const COMPLIANCE: Item[] = [
  { label: "SOC 2 Type II", icon: FileCheck },
  { label: "ISO 27001", icon: Medal },
  { label: "CJIS", icon: Fingerprint },
  { label: "NIST 800-53", icon: ListChecks },
  { label: "DFARS", icon: Landmark },
  { label: "GDPR", icon: Scale },
];

const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]";

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

export function ComplianceStrip({ className }: { className?: string }) {
  return (
    <section aria-label="Compliance roadmap" className={cn("w-full", className)}>
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Compliance roadmap · certifications in progress
      </p>

      <div className={cn("group relative flex overflow-hidden", EDGE_FADE)}>
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

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground/70">
        Listed certifications are actively in progress and not yet completed.
      </p>
    </section>
  );
}

export default ComplianceStrip;

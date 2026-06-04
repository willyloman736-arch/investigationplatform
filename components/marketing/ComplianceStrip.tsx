import { cn } from "@/lib/utils";
import {
  COMPLIANCE_ROADMAP_MARKS,
  OfficialTrustLogo,
  type OfficialTrustMark,
} from "@/components/marketing/OfficialTrustMarks";

const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]";

function CompliancePill(mark: OfficialTrustMark) {
  return (
    <li className="flex min-w-[196px] shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] py-1.5 pl-1.5 pr-4 backdrop-blur-md">
      <OfficialTrustLogo mark={mark} className="h-11 w-16 rounded-lg" />
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap text-sm font-semibold text-foreground/90">
          {mark.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary/90">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {mark.detail}
        </span>
      </span>
    </li>
  );
}

export function ComplianceStrip({ className }: { className?: string }) {
  return (
    <section aria-label="Compliance roadmap" className={cn("w-full", className)}>
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Security controls · compliance roadmap
      </p>

      <div className={cn("group relative flex overflow-hidden", EDGE_FADE)}>
        <ul className="flex shrink-0 items-center gap-3 pr-3 animate-marquee-reverse group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {COMPLIANCE_ROADMAP_MARKS.map((b) => (
            <CompliancePill key={b.label} {...b} />
          ))}
        </ul>
        <ul
          aria-hidden="true"
          className="flex shrink-0 items-center gap-3 pr-3 animate-marquee-reverse group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        >
          {COMPLIANCE_ROADMAP_MARKS.map((b) => (
            <CompliancePill key={`${b.label}-dup`} {...b} />
          ))}
        </ul>
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground/70">
        Framework badges identify the security controls and compliance programs
        the platform is organized around.
      </p>
    </section>
  );
}

export default ComplianceStrip;

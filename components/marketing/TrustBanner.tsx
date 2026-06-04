import { cn } from "@/lib/utils";
import {
  COMPLIANCE_ROADMAP_MARKS,
  OfficialTrustLogo,
  type OfficialTrustMark,
} from "@/components/marketing/OfficialTrustMarks";

/**
 * Security and compliance badges, presented as an auto-scrolling strip under
 * the hero. The detail labels describe platform alignment/readiness without
 * turning the page into a certificate claim.
 *
 * Pure-CSS marquee: two identical tracks each translating -100% for a seamless
 * loop. Pauses on hover, fades at the edges, stops for prefers-reduced-motion.
 */
const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]";

function WorkflowPill(mark: OfficialTrustMark) {
  return (
    <li className="flex min-w-[220px] shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] py-2 pl-2 pr-5 shadow-xl shadow-black/10 backdrop-blur-md">
      <OfficialTrustLogo mark={mark} className="h-14 w-20" />
      <span className="whitespace-nowrap">
        <span className="block text-sm font-semibold leading-tight text-foreground/90">
          {mark.label}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {mark.detail}
        </span>
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
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Security controls · compliance roadmap
          </p>

          {/* Trust badges — auto-scrolling */}
          <div className={cn("group relative flex overflow-hidden", EDGE_FADE)}>
            <ul className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
              {COMPLIANCE_ROADMAP_MARKS.map((b) => (
                <WorkflowPill key={b.label} {...b} />
              ))}
            </ul>
            <ul
              aria-hidden="true"
              className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
            >
              {COMPLIANCE_ROADMAP_MARKS.map((b) => (
                <WorkflowPill key={`${b.label}-dup`} {...b} />
              ))}
            </ul>
          </div>

          <p className="mt-4 px-5 text-center text-xs leading-relaxed text-muted-foreground">
            Compliance badges identify the security frameworks and controls the
            platform is organized around. Formal certification status should be
            updated only when supporting documentation is issued.
          </p>
        </div>
      </div>
    </section>
  );
}

export default TrustBanner;

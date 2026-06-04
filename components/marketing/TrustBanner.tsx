import { cn } from "@/lib/utils";
import {
  COMPLIANCE_ROADMAP_MARKS,
  OfficialTrustLogo,
  type OfficialTrustMark,
} from "@/components/marketing/OfficialTrustMarks";

/**
 * Honest compliance roadmap badges, presented as an auto-scrolling strip under
 * the hero. These are marked "In progress" so the page does not claim completed
 * certifications before completion.
 *
 * Pure-CSS marquee: two identical tracks each translating -100% for a seamless
 * loop. Pauses on hover, fades at the edges, stops for prefers-reduced-motion.
 */
const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]";

function WorkflowPill(mark: OfficialTrustMark) {
  return (
    <li className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-2 pl-2 pr-5 backdrop-blur-md">
      <OfficialTrustLogo mark={mark} />
      <span className="whitespace-nowrap">
        <span className="block text-sm font-semibold leading-tight text-foreground/90">
          {mark.label}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
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
            Compliance roadmap · certifications in progress
          </p>

          {/* Workflow trust badges — auto-scrolling */}
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
            Listed certifications are actively in progress and not yet completed.
          </p>
        </div>
      </div>
    </section>
  );
}

export default TrustBanner;

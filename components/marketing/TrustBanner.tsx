import { cn } from "@/lib/utils";
import { PROVIDER_DISCLAIMER } from "@/lib/constants";
import {
  OFFICIAL_TRUST_MARKS,
  OfficialTrustLogo,
  type OfficialTrustMark,
} from "@/components/marketing/OfficialTrustMarks";

/**
 * Honest trust badges, presented as an auto-scrolling strip under the hero.
 * They use recognizable product marks for infrastructure the project actually
 * uses or is deployment-ready for — no fabricated certifications or payment
 * provider logos before a licensed provider is integrated.
 *
 * Pure-CSS marquee: two identical tracks each translating -100% for a seamless
 * loop. Pauses on hover, fades at the edges, stops for prefers-reduced-motion.
 */
const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]";

function WorkflowPill(mark: OfficialTrustMark) {
  return (
    <li className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 backdrop-blur-md">
      <OfficialTrustLogo mark={mark} />
      <span className="whitespace-nowrap">
        <span className="block text-sm font-medium leading-tight text-foreground/90">
          {mark.label}
        </span>
        <span className="block text-[11px] leading-tight text-muted-foreground">
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
          {/* Workflow trust badges — auto-scrolling */}
          <div className={cn("group relative flex overflow-hidden", EDGE_FADE)}>
            <ul className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
              {OFFICIAL_TRUST_MARKS.map((b) => (
                <WorkflowPill key={b.label} {...b} />
              ))}
            </ul>
            <ul
              aria-hidden="true"
              className="flex shrink-0 items-center gap-3 pr-3 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
            >
              {OFFICIAL_TRUST_MARKS.map((b) => (
                <WorkflowPill key={`${b.label}-dup`} {...b} />
              ))}
            </ul>
          </div>

          <p className="mt-4 px-5 text-center text-xs leading-relaxed text-muted-foreground">
            Brand marks identify technologies used by the platform and do not
            imply sponsorship. {PROVIDER_DISCLAIMER}
          </p>
        </div>
      </div>
    </section>
  );
}

export default TrustBanner;

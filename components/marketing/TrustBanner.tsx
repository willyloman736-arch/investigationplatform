import { cn } from "@/lib/utils";
import {
  COMPLIANCE_ROADMAP_MARKS,
  OfficialTrustLogo,
  type OfficialTrustMark,
} from "@/components/marketing/OfficialTrustMarks";

/**
 * Security & compliance section under the hero.
 *
 * Presented as a calm, static, centered grid — compliance reads more credibly
 * standing still than as a sliding logo reel. Every chip shares one frame and
 * the seals are normalized to a tone-aware tile (see OfficialTrustLogo), so the
 * mixed-source set looks like one deliberate row. Wrapping with justify-center
 * keeps the final (short) row centered instead of orphaned to the left.
 */
function CredentialChip(mark: OfficialTrustMark) {
  return (
    <li className="flex w-[calc(50%-0.375rem)] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.06] sm:w-[216px]">
      <OfficialTrustLogo mark={mark} className="h-12 w-12" />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="whitespace-nowrap text-sm font-semibold text-foreground/90">
          {mark.label}
        </span>
        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-1 w-1 shrink-0 rounded-full bg-primary" />
          <span className="truncate">{mark.detail}</span>
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
      aria-label="Security and compliance"
      className={cn("relative w-full", className)}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
              Security &amp; compliance
            </p>
            <h2 className="mt-2 text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Built around recognized security frameworks
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
              The security, privacy, and data-protection standards the Digital
              Asset Investigations platform is organized around.
            </p>
          </div>

          <ul className="mx-auto mt-8 flex max-w-5xl flex-wrap items-stretch justify-center gap-3">
            {COMPLIANCE_ROADMAP_MARKS.map((mark) => (
              <CredentialChip key={mark.label} {...mark} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default TrustBanner;

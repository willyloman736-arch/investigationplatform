import { cn } from "@/lib/utils";

/**
 * Consistent section heading: optional eyebrow, title, optional subtitle.
 * Used on the landing page and inside dashboard sections.
 */
export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
  /** Render the title at a given heading level for a11y. Defaults to h2. */
  as?: "h1" | "h2" | "h3";
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
  as: Heading = "h2",
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        centered ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1",
            "text-xs font-semibold uppercase tracking-wider text-primary"
          )}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary"
            aria-hidden="true"
          />
          {eyebrow}
        </span>
      )}

      <Heading
        className={cn(
          "text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
          Heading === "h1" && "sm:text-4xl lg:text-5xl"
        )}
      >
        {title}
      </Heading>

      {subtitle && (
        <p
          className={cn(
            "text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base",
            centered ? "max-w-2xl" : "max-w-2xl"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default SectionHeading;

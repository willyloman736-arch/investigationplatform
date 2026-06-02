import Link from "next/link";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/**
 * Digital Asset Investigations brand mark.
 *
 * Renders the official DAI logo artwork from /public/brand. The app ships a dark
 * UI, so the reverse (light-on-dark) artwork is used. To rebrand, replace the
 * SVGs in /public/brand and app/icon.svg, and update APP_NAME in lib/constants.ts.
 *
 * Note: the wordmark SVG uses a Montserrat-led font stack; loaded via <img> it
 * falls back to the viewer's system sans if Montserrat is unavailable. Outline
 * the wordmark to paths for pixel-perfect type across all systems.
 */

type LogoSize = "sm" | "md" | "lg";
type LogoVariant = "full" | "icon";

export interface LogoProps {
  className?: string;
  /** Controls the rendered height. Defaults to "md". */
  size?: LogoSize;
  /** "full" = icon + wordmark; "icon" = the shield mark only. */
  variant?: LogoVariant;
  /** When provided, the logo links to this href (defaults to "/"). Pass null
   *  when the logo is already wrapped in a link to avoid nested anchors. */
  href?: string | null;
}

const HEIGHT_CLASS: Record<LogoSize, string> = {
  sm: "h-7",
  md: "h-9",
  lg: "h-12",
};

export function Logo({
  className,
  size = "md",
  variant = "full",
  href = "/",
}: LogoProps) {
  const src =
    variant === "icon"
      ? "/brand/dai-icon-reverse.svg"
      : "/brand/dai-horizontal-reverse.svg";

  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- static brand SVG; next/image adds no value for an inline vector logo
    <img
      src={src}
      alt={APP_NAME}
      className={cn("block w-auto select-none", HEIGHT_CLASS[size], className)}
      draggable={false}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${APP_NAME} home`}
        className="inline-flex shrink-0 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {img}
      </Link>
    );
  }

  return img;
}

export default Logo;

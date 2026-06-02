import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/**
 * AEGIS brand mark: a lucide ShieldCheck inside a soft emerald glass tile plus
 * the wordmark. To rebrand the whole app, change APP_NAME in lib/constants.ts
 * and swap the icon here.
 */

type LogoSize = "sm" | "md" | "lg";
type LogoVariant = "full" | "icon";

export interface LogoProps {
  className?: string;
  /** Controls icon tile + wordmark sizing. Defaults to "md". */
  size?: LogoSize;
  /** "full" shows icon + wordmark; "icon" shows only the shield tile. */
  variant?: LogoVariant;
  /** When provided, the logo renders as a link to this href (defaults to "/"). */
  href?: string | null;
}

const SIZE_MAP: Record<
  LogoSize,
  { tile: string; icon: string; word: string }
> = {
  sm: { tile: "h-7 w-7 rounded-lg", icon: "h-4 w-4", word: "text-base" },
  md: { tile: "h-9 w-9 rounded-xl", icon: "h-5 w-5", word: "text-lg" },
  lg: { tile: "h-12 w-12 rounded-2xl", icon: "h-7 w-7", word: "text-2xl" },
};

export function Logo({
  className,
  size = "md",
  variant = "full",
  href = "/",
}: LogoProps) {
  const s = SIZE_MAP[size];

  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative inline-flex items-center justify-center",
          "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30",
          "shadow-[0_0_20px_-6px_hsl(var(--primary))]",
          s.tile
        )}
        aria-hidden="true"
      >
        <ShieldCheck className={s.icon} strokeWidth={2.25} />
      </span>
      {variant === "full" && (
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            s.word
          )}
        >
          {APP_NAME}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${APP_NAME} home`}
        className="inline-flex rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

export default Logo;

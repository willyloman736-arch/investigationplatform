import { cn } from "@/lib/utils";

export interface OfficialTrustMark {
  label: string;
  detail: string;
  logoSrc: string;
  logoAlt: string;
}

export const OFFICIAL_TRUST_MARKS: OfficialTrustMark[] = [
  {
    label: "Supabase Auth",
    detail: "Role-based access",
    logoSrc: "https://cdn.simpleicons.org/supabase/3FCF8E",
    logoAlt: "Supabase",
  },
  {
    label: "Supabase Storage",
    detail: "Private evidence bucket",
    logoSrc: "https://cdn.simpleicons.org/supabase/3FCF8E",
    logoAlt: "Supabase",
  },
  {
    label: "PostgreSQL RLS",
    detail: "Case-scoped records",
    logoSrc: "https://cdn.simpleicons.org/postgresql/4169E1",
    logoAlt: "PostgreSQL",
  },
  {
    label: "Vercel Ready",
    detail: "Deployment hardened",
    logoSrc: "https://cdn.simpleicons.org/vercel/FFFFFF",
    logoAlt: "Vercel",
  },
  {
    label: "Next.js App Router",
    detail: "Server-side workflows",
    logoSrc: "https://cdn.simpleicons.org/nextdotjs/FFFFFF",
    logoAlt: "Next.js",
  },
];

export const HERO_TRUST_MARKS: OfficialTrustMark[] = [
  OFFICIAL_TRUST_MARKS[0],
  OFFICIAL_TRUST_MARKS[2],
  OFFICIAL_TRUST_MARKS[3],
  OFFICIAL_TRUST_MARKS[4],
];

interface OfficialTrustLogoProps {
  mark: OfficialTrustMark;
  className?: string;
}

export function OfficialTrustLogo({
  mark,
  className,
}: OfficialTrustLogoProps) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.08] p-1.5",
        className
      )}
    >
      <img
        src={mark.logoSrc}
        alt=""
        width={20}
        height={20}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-5 w-5 object-contain"
      />
      <span className="sr-only">{mark.logoAlt}</span>
    </span>
  );
}


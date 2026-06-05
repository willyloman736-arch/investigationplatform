import Image from "next/image";

import { cn } from "@/lib/utils";

export interface OfficialTrustMark {
  label: string;
  detail: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * Background baked into the source seal art. Light-art seals (white canvas)
   * sit on a white chip; dark-art seals (near-black canvas) sit on a deep-navy
   * chip so no stray square shows through. This is what lets a mixed-source set
   * read as one consistent, deliberate row.
   */
  tone: "light" | "dark";
}

export const OFFICIAL_TRUST_MARKS: OfficialTrustMark[] = [
  {
    label: "ISO 27001",
    detail: "Security management",
    src: "/trust-badges/iso-27001.jpeg",
    alt: "ISO 27001 information security management badge",
    width: 404,
    height: 404,
    tone: "light",
  },
  {
    label: "CJIS ACE",
    detail: "Audit commitment",
    src: "/trust-badges/cjis-ace.jpeg",
    alt: "CJIS ACE audit and compliance experts badge",
    width: 980,
    height: 746,
    tone: "dark",
  },
  {
    label: "NIST 800-53",
    detail: "Control mapping",
    src: "/trust-badges/nist-800-53.jpeg",
    alt: "NIST 800-53 Revision 5 security controls badge",
    width: 600,
    height: 300,
    tone: "light",
  },
  {
    label: "DFARS",
    detail: "Defense controls",
    src: "/trust-badges/dfars-dod.jpeg",
    alt: "United States Department of Defense badge for DFARS-aligned controls",
    width: 720,
    height: 720,
    tone: "dark",
  },
  {
    label: "GDPR",
    detail: "Privacy framework",
    src: "/trust-badges/gdpr-compliant.jpeg",
    alt: "EU GDPR compliant badge",
    width: 392,
    height: 400,
    tone: "light",
  },
  {
    label: "SOC 2 Type II",
    detail: "Audit readiness",
    src: "/trust-badges/soc2-type-ii.jpeg",
    alt: "SOC 2 Type II compliant badge",
    width: 800,
    height: 800,
    tone: "dark",
  },
  {
    label: "SSL Secure",
    detail: "TLS encryption",
    src: "/trust-badges/ssl-secure.jpeg",
    alt: "SSL secure badge",
    width: 680,
    height: 380,
    tone: "light",
  },
];

export const HERO_TRUST_MARKS: OfficialTrustMark[] = [
  OFFICIAL_TRUST_MARKS[0],
  OFFICIAL_TRUST_MARKS[2],
  OFFICIAL_TRUST_MARKS[4],
  OFFICIAL_TRUST_MARKS[5],
];

export const COMPLIANCE_ROADMAP_MARKS: OfficialTrustMark[] = OFFICIAL_TRUST_MARKS;

interface OfficialTrustLogoProps {
  mark: OfficialTrustMark;
  className?: string;
}

/**
 * A single seal rendered inside a uniform, tone-aware chip. The frame (size,
 * radius, border, ring, shadow, padding) is identical for every mark; only the
 * fill colour follows the seal's own canvas so dark-art seals don't show a black
 * square on a white tile (and vice-versa). Callers may override size via
 * className — twMerge keeps the last size class.
 */
export function OfficialTrustLogo({
  mark,
  className,
}: OfficialTrustLogoProps) {
  return (
    <span
      className={cn(
        "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-2 shadow-md shadow-black/20",
        mark.tone === "dark"
          ? "border-white/10 bg-[#0a0f18] ring-1 ring-inset ring-white/10"
          : "border-black/5 bg-white ring-1 ring-inset ring-black/5",
        className
      )}
    >
      <Image
        src={mark.src}
        alt={mark.alt}
        width={mark.width}
        height={mark.height}
        className="h-full w-full object-contain"
      />
      <span className="sr-only">{mark.label}</span>
    </span>
  );
}

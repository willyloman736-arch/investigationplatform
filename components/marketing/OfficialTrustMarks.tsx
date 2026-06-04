import Image from "next/image";

import { cn } from "@/lib/utils";

export interface OfficialTrustMark {
  label: string;
  detail: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

export const OFFICIAL_TRUST_MARKS: OfficialTrustMark[] = [
  {
    label: "ISO 27001",
    detail: "Security management",
    src: "/trust-badges/iso-27001.jpeg",
    alt: "ISO 27001 information security management badge",
    width: 404,
    height: 404,
  },
  {
    label: "CJIS ACE",
    detail: "Audit commitment",
    src: "/trust-badges/cjis-ace.jpeg",
    alt: "CJIS ACE audit and compliance experts badge",
    width: 980,
    height: 746,
  },
  {
    label: "NIST 800-53",
    detail: "Control mapping",
    src: "/trust-badges/nist-800-53.jpeg",
    alt: "NIST 800-53 Revision 5 security controls badge",
    width: 600,
    height: 300,
  },
  {
    label: "DFARS",
    detail: "Defense controls",
    src: "/trust-badges/dfars-dod.jpeg",
    alt: "United States Department of Defense badge for DFARS-aligned controls",
    width: 720,
    height: 720,
  },
  {
    label: "GDPR",
    detail: "Privacy framework",
    src: "/trust-badges/gdpr-compliant.jpeg",
    alt: "EU GDPR compliant badge",
    width: 392,
    height: 400,
  },
  {
    label: "SOC 2 Type II",
    detail: "Audit readiness",
    src: "/trust-badges/soc2-type-ii.jpeg",
    alt: "SOC 2 Type II compliant badge",
    width: 800,
    height: 800,
  },
  {
    label: "SSL Secure",
    detail: "TLS protected",
    src: "/trust-badges/ssl-secure.jpeg",
    alt: "SSL secure badge",
    width: 680,
    height: 380,
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

export function OfficialTrustLogo({
  mark,
  className,
}: OfficialTrustLogoProps) {
  return (
    <span
      className={cn(
        "relative flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white p-1 shadow-lg shadow-black/15",
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

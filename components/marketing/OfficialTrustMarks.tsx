import {
  Award,
  ClipboardCheck,
  FileCheck2,
  Fingerprint,
  Landmark,
  Scale,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface OfficialTrustMark {
  label: string;
  detail: string;
  icon: LucideIcon;
}

export const OFFICIAL_TRUST_MARKS: OfficialTrustMark[] = [
  {
    label: "ISO 27001",
    detail: "In progress",
    icon: Award,
  },
  {
    label: "CJIS",
    detail: "In progress",
    icon: Fingerprint,
  },
  {
    label: "NIST 800-53",
    detail: "In progress",
    icon: ClipboardCheck,
  },
  {
    label: "DFARS",
    detail: "In progress",
    icon: Landmark,
  },
  {
    label: "GDPR",
    detail: "In progress",
    icon: Scale,
  },
  {
    label: "SOC 2 Type II",
    detail: "In progress",
    icon: FileCheck2,
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
  const Icon = mark.icon;

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-300",
        className
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      <span className="sr-only">{mark.label}</span>
    </span>
  );
}

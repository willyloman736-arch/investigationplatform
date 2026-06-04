import { cn } from "@/lib/utils";

export interface OfficialTrustMark {
  label: string;
  detail: string;
  logoSrc: string;
  logoAlt: string;
}

export const OFFICIAL_TRUST_MARKS: OfficialTrustMark[] = [
  {
    label: "Visa",
    detail: "Card payout option",
    logoSrc: "https://cdn.simpleicons.org/visa/1A1F71",
    logoAlt: "Visa",
  },
  {
    label: "Mastercard",
    detail: "Card payout option",
    logoSrc: "https://cdn.simpleicons.org/mastercard/EB001B",
    logoAlt: "Mastercard",
  },
  {
    label: "American Express",
    detail: "Card payout option",
    logoSrc: "https://cdn.simpleicons.org/americanexpress/2E77BB",
    logoAlt: "American Express",
  },
  {
    label: "PayPal",
    detail: "Digital payout option",
    logoSrc: "https://cdn.simpleicons.org/paypal/00457C",
    logoAlt: "PayPal",
  },
];

export const HERO_TRUST_MARKS: OfficialTrustMark[] = [
  OFFICIAL_TRUST_MARKS[0],
  OFFICIAL_TRUST_MARKS[1],
  OFFICIAL_TRUST_MARKS[2],
  OFFICIAL_TRUST_MARKS[3],
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

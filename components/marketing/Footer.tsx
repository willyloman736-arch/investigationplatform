import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { APP_NAME, APP_TAGLINE, PROVIDER_DISCLAIMER } from "@/lib/constants";
import { ComplianceStrip } from "@/components/marketing/ComplianceStrip";

interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}

const COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Recovery workflow", href: "/how-it-works#workflow" },
      { label: "Escrow statuses", href: "/how-it-works#statuses" },
      { label: "Open recovery case", href: "/register" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "Client portal", href: "/login" },
      { label: "Operator sign-in", href: "/operator" },
      { label: "Open secure escrow account", href: "/register" },
      { label: "Withdrawal approval", href: "/how-it-works#workflow" },
      { label: "Evidence audit trail", href: "/how-it-works#security" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "Security overview", href: "/#security" },
      { label: "Contact", href: "/#product" },
    ],
  },
];

/**
 * Public marketing footer: link columns, honest compliance disclaimer, and
 * copyright. The brand name comes from APP_NAME (changeable in lib/constants.ts).
 */
export function Footer() {
  const year = 2026;

  return (
    <footer className="relative border-t border-white/10 bg-card/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Compliance roadmap — moved here from the hero to keep the top clean */}
        <div className="mb-10 border-b border-white/10 pb-10">
          <ComplianceStrip />
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand block */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`${APP_NAME} home`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                {APP_NAME}
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {APP_TAGLINE} for crypto scam recovery complaints. File a case,
              upload evidence, complete KYC, and track recovered funds in
              admin-controlled escrow.
            </p>
            <p className="mt-5 max-w-sm text-xs leading-relaxed text-muted-foreground/80">
              {PROVIDER_DISCLAIMER}
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold text-foreground">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={`${col.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {year} {APP_NAME}. All rights reserved.
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground/80">
            {APP_NAME} is a recovery workflow and escrow management platform. It
            does not itself hold, transfer, or custody funds. All fund movement
            is performed by protected server-side provider workflows where
            available.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

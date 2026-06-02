"use client";

import {
  Lock,
  UserCheck,
  BadgeCheck,
  ShieldCheck,
  FileSearch,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { PROVIDER_DISCLAIMER } from "@/lib/constants";

interface TrustBadge {
  label: string;
  icon: LucideIcon;
}

/**
 * Honest trust badges. These describe workflow guarantees the platform actually
 * provides (a secure client portal, an escrow workflow, an evidence audit
 * trail). "SSL Encrypted" refers to transport security (HTTPS), not any
 * end-to-end claim. The disclaimer below keeps fund-movement copy accurate.
 */
const BADGES: TrustBadge[] = [
  { label: "SSL Encrypted", icon: Lock },
  { label: "Secure Client Portal", icon: UserCheck },
  { label: "Verified Company Registration", icon: BadgeCheck },
  { label: "Escrow Workflow Protected", icon: ShieldCheck },
  { label: "Evidence Audit Trail", icon: FileSearch },
];

interface TrustBannerProps {
  className?: string;
}

export function TrustBanner({ className }: TrustBannerProps) {
  return (
    <section
      aria-label="Trust and compliance"
      className={cn("relative w-full", className)}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 backdrop-blur-md sm:px-8 sm:py-7">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 sm:gap-x-8">
            {BADGES.map((badge, i) => {
              const Icon = badge.icon;
              return (
                <motion.li
                  key={badge.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="flex items-center gap-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-foreground/90">
                    {badge.label}
                  </span>
                </motion.li>
              );
            })}
          </ul>

          <p className="mt-6 border-t border-white/10 pt-5 text-center text-xs leading-relaxed text-muted-foreground">
            {PROVIDER_DISCLAIMER}
          </p>
        </div>
      </div>
    </section>
  );
}

export default TrustBanner;

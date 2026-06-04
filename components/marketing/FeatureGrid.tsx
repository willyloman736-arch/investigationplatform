"use client";

import {
  FolderKanban,
  IdCard,
  FileSearch,
  CreditCard,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const FEATURES: Feature[] = [
  {
    title: "Complaint intake",
    description:
      "File a crypto scam complaint, upload transaction hashes, receipts, screenshots, and messages, then track case review in one workspace.",
    icon: FolderKanban,
  },
  {
    title: "KYC verification",
    description:
      "Clients complete government ID, selfie, proof of address, phone, and email checks before withdrawal approval.",
    icon: IdCard,
  },
  {
    title: "Evidence review",
    description:
      "Recovery specialists review the file, request more evidence when needed, issue a decision, and keep every milestone timestamped.",
    icon: FileSearch,
  },
  {
    title: "Recovered-funds escrow",
    description:
      "When recovered funds are confirmed, the escrow record is updated so clients can view the account balance in their portal.",
    icon: Wallet,
  },
  {
    title: "Authorized withdrawals",
    description:
      "Clients can request Bank Transfer, Visa/Mastercard, or PayPal withdrawal once release eligibility is authorized.",
    icon: CreditCard,
  },
  {
    title: "Receipts & audit trail",
    description:
      "Downloadable PDF receipts, case notifications, and review milestones are preserved in an append-only audit trail.",
    icon: ReceiptText,
  },
];

/**
 * Animated feature grid for the landing page. Kept as a client component so the
 * page itself can stay a Server Component while still getting scroll-in motion.
 */
export function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature, i) => {
        const Icon = feature.icon;
        return (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: "easeOut" }}
            className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-colors hover:border-primary/30"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25 transition-transform duration-300 group-hover:scale-105">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

export default FeatureGrid;

"use client";

import {
  FolderKanban,
  Landmark,
  FileSearch,
  MessagesSquare,
  Scale,
  ScrollText,
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
    title: "Case & project management",
    description:
      "Open structured investigation or transaction cases, invite counterparties, and keep every party, document, and decision in one organized workspace.",
    icon: FolderKanban,
  },
  {
    title: "Escrow held by licensed partners",
    description:
      "Funds are deposited and held through licensed payment/escrow partners. AEGIS tracks status — it never custodies or moves money itself.",
    icon: Landmark,
  },
  {
    title: "Verified evidence vault",
    description:
      "Upload receipts, CSVs, chat logs, and transaction references with type and size validation. Everything is attributed and timestamped.",
    icon: FileSearch,
  },
  {
    title: "Logged secure messaging",
    description:
      "Communicate inside each case. Messages are logged for dispute review so the record is complete if a disagreement arises.",
    icon: MessagesSquare,
  },
  {
    title: "Mutual-approval release",
    description:
      "Funds release only when both parties approve, or when an admin resolves a dispute. No single party — and no admin — can move funds unilaterally.",
    icon: Scale,
  },
  {
    title: "Tamper-evident audit trail",
    description:
      "Every important action writes an append-only audit log entry, giving you and reviewers a defensible history of the entire case.",
    icon: ScrollText,
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

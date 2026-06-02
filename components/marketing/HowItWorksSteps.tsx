"use client";

import * as React from "react";
import {
  FileSignature,
  Landmark,
  SearchCheck,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type Variant = "compact" | "full";

interface Chip {
  label: string;
  tone: "escrow" | "dispute";
}

interface Step {
  number: number;
  title: string;
  short: string;
  long: string;
  icon: LucideIcon;
  chip?: Chip;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Contract Setup",
    short:
      "Open a case and define the terms. Both parties review and sign the agreement before any funds move.",
    long: "Open an investigation or project case, invite the counterparty, and lay out the deliverables, timeline, and contract terms. Nothing proceeds until Party A and Party B have both signed the agreement, so expectations are locked in from the start.",
    icon: FileSignature,
  },
  {
    number: 2,
    title: "Funding the Escrow",
    short:
      "The client funds the escrow through a licensed partner. Funds are held — never released early.",
    long: "The client deposits funds through a licensed payment/escrow partner. Once the partner confirms the deposit, the case is marked securely escrowed. The money is held against the contract and cannot be released until the release conditions are met.",
    icon: Landmark,
    chip: { label: "HELD IN ESCROW", tone: "escrow" },
  },
  {
    number: 3,
    title: "Verification & Execution",
    short:
      "Evidence is uploaded, communication is logged, and the work is verified against the agreed terms.",
    long: "Work is carried out and documented. Parties upload evidence — receipts, CSVs, chat logs, transaction references — and communicate inside the case. Every action is recorded to an audit trail so the outcome can be verified against the contract.",
    icon: SearchCheck,
  },
  {
    number: 4,
    title: "Mutual Release",
    short:
      "Funds release only after both parties approve — or after an admin resolves a dispute.",
    long: "Release requires explicit approval from both Party A and Party B. If something goes wrong, either side can raise a dispute, which freezes release while an admin reviews the evidence and resolves it. Funds are released only after the licensed partner confirms.",
    icon: Handshake,
    chip: { label: "UNDER DISPUTE AUDIT", tone: "dispute" },
  },
];

const CHIP_TONES: Record<Chip["tone"], string> = {
  escrow:
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  dispute: "bg-red-500/10 text-red-400 border border-red-500/30",
};

export interface HowItWorksStepsProps {
  /** "compact" = landing teaser; "full" = transparency page detail. */
  variant?: Variant;
  className?: string;
}

/**
 * The 4-step escrow lifecycle, reused on the landing teaser and the full
 * /how-it-works transparency page. Step 2 carries a [HELD IN ESCROW] chip and
 * step 4 carries an [UNDER DISPUTE AUDIT] note, mirroring real escrow states.
 */
export function HowItWorksSteps({
  variant = "full",
  className,
}: HowItWorksStepsProps) {
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        compact ? "lg:grid-cols-4" : "lg:grid-cols-2",
        className
      )}
    >
      {STEPS.map((step, i) => (
        <StepCard key={step.number} step={step} compact={compact} index={i} />
      ))}
    </div>
  );
}

function StepCard({
  step,
  compact,
  index,
}: {
  step: Step;
  compact: boolean;
  index: number;
}) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className={cn(
        "relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors hover:border-primary/30",
        compact ? "p-5" : "p-6 sm:p-7"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          aria-hidden="true"
          className="text-2xl font-semibold tabular-nums text-white/15"
        >
          {String(step.number).padStart(2, "0")}
        </span>
      </div>

      <h3
        className={cn(
          "mt-5 font-semibold tracking-tight text-foreground",
          compact ? "text-base" : "text-lg"
        )}
      >
        <span className="sr-only">{`Step ${step.number}: `}</span>
        {step.title}
      </h3>

      <p
        className={cn(
          "mt-2 flex-1 leading-relaxed text-muted-foreground",
          compact ? "text-sm" : "text-sm sm:text-base"
        )}
      >
        {compact ? step.short : step.long}
      </p>

      {step.chip ? (
        <div className="mt-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
              CHIP_TONES[step.chip.tone]
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                step.chip.tone === "escrow" ? "bg-emerald-400" : "bg-red-400"
              )}
              aria-hidden="true"
            />
            {step.chip.label}
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}

export default HowItWorksSteps;

"use client";

import * as React from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { Wallet, ShieldCheck, FileCheck2, type LucideIcon } from "lucide-react";

import { cn, formatCurrency } from "@/lib/utils";

type StatFormat = "currency" | "number";

interface StatDef {
  key: string;
  label: string;
  value: number;
  format: StatFormat;
  icon: LucideIcon;
  /** Optional suffix appended after the formatted value (e.g. "+"). */
  suffix?: string;
}

export interface StatsCounterProps {
  /** Total recovered value reflected across escrow accounts (currency). */
  totalTransactedPool: number;
  /** Count of disputes resolved. */
  activeDisputesResolved: number;
  /** Count of currently active escrow accounts. */
  activeEscrowContracts: number;
  /** ISO currency code for the transacted pool. */
  currency?: string;
  className?: string;
}

/**
 * Animated headline metrics for the landing page.
 *
 * Values are passed in via props (sourced from getStats() in lib/data.ts on the
 * server) so they can later be pulled straight from Supabase without touching
 * this component. Each card counts up from 0 when it scrolls into view.
 */
export function StatsCounter({
  totalTransactedPool,
  activeDisputesResolved,
  activeEscrowContracts,
  currency = "USD",
  className,
}: StatsCounterProps) {
  const stats: StatDef[] = [
    {
      key: "pool",
      label: "Recovered Funds Pool",
      value: totalTransactedPool,
      format: "currency",
      icon: Wallet,
    },
    {
      key: "disputes",
      label: "Active Disputes Resolved",
      value: activeDisputesResolved,
      format: "number",
      icon: ShieldCheck,
      suffix: "+",
    },
    {
      key: "contracts",
      label: "Active Escrow Accounts",
      value: activeEscrowContracts,
      format: "number",
      icon: FileCheck2,
    },
  ];

  return (
    <section aria-label="Platform statistics" className={cn("w-full", className)}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
        {stats.map((stat, i) => (
          <StatTile key={stat.key} stat={stat} currency={currency} index={i} />
        ))}
      </div>
    </section>
  );
}

function StatTile({
  stat,
  currency,
  index,
}: {
  stat: StatDef;
  currency: string;
  index: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = stat.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-colors hover:border-primary/30"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100 sm:opacity-60"
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
      </div>

      <div className="relative mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        <AnimatedValue
          to={stat.value}
          play={inView}
          format={stat.format}
          currency={currency}
          suffix={stat.suffix}
        />
      </div>
    </motion.div>
  );
}

function AnimatedValue({
  to,
  play,
  format,
  currency,
  suffix,
}: {
  to: number;
  play: boolean;
  format: StatFormat;
  currency: string;
  suffix?: string;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    const v = Math.round(latest);
    const base =
      format === "currency"
        ? formatCurrencyCompact(v, currency)
        : v.toLocaleString("en-US");
    return suffix ? `${base}${suffix}` : base;
  });

  React.useEffect(() => {
    if (!play) return;
    const controls = animate(count, to, {
      duration: 1.6,
      ease: "circOut",
    });
    return controls.stop;
  }, [play, to, count]);

  return <motion.span>{rounded}</motion.span>;
}

/**
 * Compact currency for large headline pools (e.g. "$12.4M"). Falls back to the
 * shared formatCurrency helper for smaller values to keep formatting consistent.
 */
function formatCurrencyCompact(value: number, currency: string): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted = millions >= 100 ? Math.round(millions) : millions.toFixed(1);
    return `${symbolFor(currency)}${formatted}M`;
  }
  if (value >= 10_000) {
    const thousands = value / 1_000;
    const formatted = thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1);
    return `${symbolFor(currency)}${formatted}K`;
  }
  return formatCurrency(value, currency);
}

function symbolFor(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? "$";
  } catch {
    return "$";
  }
}

export default StatsCounter;

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Icon3D — a dimensional, glassy "app-icon" tile around a Lucide glyph.
 *
 * Pure vector (no image assets): a squircle tile with a top sheen, inset
 * highlight, depth shadow and a tone-colored glow, plus a top-lit gradient on
 * the glyph and a soft drop-shadow for extrusion. Reads as a premium 3D icon
 * while scaling crisply to any size.
 *
 * Render <Icon3DDefs /> once per page (done in the admin layout) so the shared
 * gradient/filter paint servers are available to every Icon3D.
 */

export type Icon3DTone =
  | "blue"
  | "cyan"
  | "emerald"
  | "amber"
  | "red"
  | "violet"
  | "slate";

const TONES: Record<
  Icon3DTone,
  { tileFrom: string; tileTo: string; border: string; glow: string }
> = {
  blue: {
    tileFrom: "rgba(37,99,235,0.40)",
    tileTo: "rgba(37,99,235,0.10)",
    border: "rgba(147,178,255,0.38)",
    glow: "rgba(37,99,235,0.55)",
  },
  cyan: {
    tileFrom: "rgba(34,211,238,0.36)",
    tileTo: "rgba(13,148,179,0.10)",
    border: "rgba(125,235,250,0.42)",
    glow: "rgba(34,211,238,0.50)",
  },
  emerald: {
    tileFrom: "rgba(16,185,129,0.36)",
    tileTo: "rgba(16,185,129,0.09)",
    border: "rgba(110,231,183,0.38)",
    glow: "rgba(16,185,129,0.45)",
  },
  amber: {
    tileFrom: "rgba(245,158,11,0.36)",
    tileTo: "rgba(245,158,11,0.09)",
    border: "rgba(253,211,77,0.38)",
    glow: "rgba(245,158,11,0.45)",
  },
  red: {
    tileFrom: "rgba(239,68,68,0.36)",
    tileTo: "rgba(239,68,68,0.09)",
    border: "rgba(252,165,165,0.38)",
    glow: "rgba(239,68,68,0.45)",
  },
  violet: {
    tileFrom: "rgba(139,92,246,0.36)",
    tileTo: "rgba(139,92,246,0.09)",
    border: "rgba(196,181,253,0.38)",
    glow: "rgba(139,92,246,0.45)",
  },
  slate: {
    tileFrom: "rgba(148,163,184,0.28)",
    tileTo: "rgba(100,116,139,0.08)",
    border: "rgba(203,213,225,0.30)",
    glow: "rgba(148,163,184,0.35)",
  },
};

/** Solid stroke fallback so glyphs still paint if the gradient defs are absent. */
const GLYPH_FALLBACK: Record<Icon3DTone, string> = {
  blue: "#93c5fd",
  cyan: "#67e8f9",
  emerald: "#6ee7b7",
  amber: "#fcd34d",
  red: "#fca5a5",
  violet: "#c4b5fd",
  slate: "#cbd5e1",
};

export interface Icon3DProps {
  icon: LucideIcon;
  tone?: Icon3DTone;
  /** Tile edge length in px. */
  size?: number;
  className?: string;
}

export function Icon3D({
  icon: Icon,
  tone = "blue",
  size = 40,
  className,
}: Icon3DProps) {
  const t = TONES[tone];
  const glyph = Math.round(size * 0.48);

  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundImage: `linear-gradient(155deg, ${t.tileFrom}, ${t.tileTo})`,
        border: `1px solid ${t.border}`,
        boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.40), inset 0 -8px 14px rgba(2,10,22,0.40), 0 10px 20px -8px rgba(2,10,22,0.85), 0 0 24px -10px ${t.glow}`,
      }}
    >
      {/* Glossy top sheen */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 48%)",
        }}
      />
      <Icon
        width={glyph}
        height={glyph}
        strokeWidth={2}
        className="relative"
        style={{
          stroke: `url(#icon3d-grad-${tone}) ${GLYPH_FALLBACK[tone]}`,
          filter: "url(#icon3d-shadow)",
        }}
      />
    </span>
  );
}

/**
 * Shared SVG paint servers for Icon3D (top-lit glyph gradients + a soft drop
 * shadow). Render once per page; lives in a zero-size, non-display:none svg so
 * the gradient references resolve in every browser.
 */
export function Icon3DDefs() {
  const tones: Array<[Icon3DTone, string, string]> = [
    ["blue", "#dbeafe", "#3b82f6"],
    ["cyan", "#cffafe", "#22d3ee"],
    ["emerald", "#d1fae5", "#10b981"],
    ["amber", "#fef3c7", "#f59e0b"],
    ["red", "#fee2e2", "#ef4444"],
    ["violet", "#ede9fe", "#8b5cf6"],
    ["slate", "#f1f5f9", "#94a3b8"],
  ];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        {tones.map(([tone, from, to]) => (
          <linearGradient
            key={tone}
            id={`icon3d-grad-${tone}`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2="24"
          >
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        ))}
        <filter
          id="icon3d-shadow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="0.7"
            floodColor="rgba(2,10,22,0.5)"
          />
        </filter>
      </defs>
    </svg>
  );
}

export default Icon3D;

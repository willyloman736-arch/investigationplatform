"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Dependency-free SVG area sparkline. Decorative (aria-hidden) — the underlying
 * value is always shown as text next to it, so it never carries meaning alone.
 * Stretches to its container; stroke stays crisp via non-scaling-stroke.
 */
export function Sparkline({
  data,
  className,
  color = "hsl(var(--primary))",
  strokeWidth = 2,
}: {
  data: number[];
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  const id = useId();
  if (!data || data.length < 2) return null;

  const width = 300;
  const height = 72;
  const pad = strokeWidth + 1;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const y = (d: number) =>
    height - pad - ((d - min) / range) * (height - pad * 2);

  const points = data.map((d, i) => `${(i * stepX).toFixed(1)},${y(d).toFixed(1)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gradientId = `spark-${id}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-16 w-full", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default Sparkline;

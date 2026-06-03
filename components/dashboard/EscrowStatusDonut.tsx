import { cn } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Dependency-free SVG donut for escrow-status distribution. Accessible: each
 * segment is also listed in the legend with its label + count (never color
 * alone), and the chart carries a text summary via role="img".
 */
export function EscrowStatusDonut({
  segments,
  centerValue,
  centerLabel,
  className,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const size = 168;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let acc = 0;
  const summary =
    total > 0
      ? `Escrow status distribution: ${segments
          .map((s) => `${s.label} ${s.value}`)
          .join(", ")}.`
      : "No active escrow accounts yet.";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-6 sm:flex-row sm:items-center",
        className
      )}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={summary}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {total > 0 &&
            segments.map((seg) => {
              const len = (seg.value / total) * c;
              const node = (
                <circle
                  key={seg.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-acc}
                  strokeLinecap="butt"
                />
              );
              acc += len;
              return node;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {centerValue}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className="grid w-full gap-2.5">
        {segments.map((seg) => (
          <li
            key={seg.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: seg.color }}
                aria-hidden="true"
              />
              {seg.label}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {seg.value}
            </span>
          </li>
        ))}
        {total === 0 ? (
          <li className="text-sm text-muted-foreground">
            No active escrow accounts yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export default EscrowStatusDonut;

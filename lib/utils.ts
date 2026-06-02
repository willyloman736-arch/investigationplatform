import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

/**
 * Merge Tailwind class names safely (clsx for conditionals, tailwind-merge to
 * resolve conflicting utilities).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric amount as currency. Defaults to USD. Falls back gracefully
 * for unknown currency codes.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "USD"
): string {
  const value =
    typeof amount === "string" ? Number.parseFloat(amount) : amount ?? 0;
  const safe = Number.isFinite(value as number) ? (value as number) : 0;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    // Unknown currency code — format as a plain number with the code appended.
    return `${safe.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }
}

/** Coerce a Date | ISO string into a valid Date, or null. */
function toDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return isValid(date) ? date : null;
  const parsed = parseISO(date);
  if (isValid(parsed)) return parsed;
  const fallback = new Date(date);
  return isValid(fallback) ? fallback : null;
}

/** Format a date as e.g. "Jan 5, 2026". */
export function formatDate(date: Date | string | null | undefined): string {
  const d = toDate(date);
  if (!d) return "—";
  return format(d, "MMM d, yyyy");
}

/** Format a date with time as e.g. "Jan 5, 2026, 2:30 PM". */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = toDate(date);
  if (!d) return "—";
  return format(d, "MMM d, yyyy, h:mm a");
}

import { describe, it, expect } from "vitest";

import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting Tailwind utilities (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy conditional classes", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});

describe("formatCurrency", () => {
  it("formats numbers as USD by default", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("parses numeric strings", () => {
    expect(formatCurrency("2500.5")).toBe("$2,500.50");
  });

  it("defaults nullish input to zero", () => {
    expect(formatCurrency(null)).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
  });

  it("supports other ISO currencies", () => {
    expect(formatCurrency(1000, "EUR")).toContain("1,000.00");
  });

  it("falls back gracefully for an invalid currency code", () => {
    // 2-letter code is not a valid ISO 4217 currency -> Intl throws -> fallback.
    const out = formatCurrency(50, "ZZ");
    expect(out).toContain("50.00");
    expect(out).toContain("ZZ");
  });
});

describe("formatDate / formatDateTime", () => {
  it("formats an ISO date", () => {
    expect(formatDate("2026-01-05")).toBe("Jan 5, 2026");
  });

  it("returns an em dash for missing/invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("includes the date in a date-time format", () => {
    expect(formatDateTime("2026-01-05T14:30:00")).toContain("Jan 5, 2026");
  });
});

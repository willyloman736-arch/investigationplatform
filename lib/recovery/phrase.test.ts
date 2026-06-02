import { describe, it, expect } from "vitest";

import {
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  normalizeRecoveryPhrase,
  recoveryPhraseWords,
  RECOVERY_WORD_COUNT,
} from "@/lib/recovery/phrase";

describe("generateRecoveryPhrase", () => {
  it("produces a valid 12-word phrase", () => {
    const p = generateRecoveryPhrase();
    expect(p.split(" ")).toHaveLength(RECOVERY_WORD_COUNT);
    expect(validateRecoveryPhrase(p)).toBe(true);
  });

  it("produces a different phrase on each call", () => {
    expect(generateRecoveryPhrase()).not.toBe(generateRecoveryPhrase());
  });
});

describe("validateRecoveryPhrase", () => {
  it("accepts a generated phrase regardless of casing/whitespace", () => {
    const messy = "   " + generateRecoveryPhrase().toUpperCase() + "  ";
    expect(validateRecoveryPhrase(messy)).toBe(true);
  });

  it("rejects wrong word counts, words outside the list, and empty input", () => {
    expect(validateRecoveryPhrase("")).toBe(false);
    expect(validateRecoveryPhrase("abandon abandon abandon")).toBe(false); // 3 words
    expect(validateRecoveryPhrase(Array(12).fill("zzzz").join(" "))).toBe(false); // not in wordlist
  });

  it("rejects 12 valid words with a bad checksum", () => {
    // 12 in-wordlist words, but the checksum is (almost certainly) wrong.
    expect(validateRecoveryPhrase(Array(12).fill("abandon").join(" "))).toBe(false);
  });
});

describe("normalizeRecoveryPhrase / recoveryPhraseWords", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeRecoveryPhrase("  Foo   BAR baz ")).toBe("foo bar baz");
  });

  it("splits a generated phrase into 12 words", () => {
    expect(recoveryPhraseWords(generateRecoveryPhrase())).toHaveLength(
      RECOVERY_WORD_COUNT
    );
  });
});

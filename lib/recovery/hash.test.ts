import { describe, it, expect } from "vitest";

import { hashPhrase, verifyPhrase } from "@/lib/recovery/hash";

const PHRASE =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";

describe("hashPhrase / verifyPhrase", () => {
  it("verifies the correct phrase", async () => {
    const stored = await hashPhrase(PHRASE);
    expect(await verifyPhrase(PHRASE, stored)).toBe(true);
  });

  it("rejects an incorrect phrase", async () => {
    const stored = await hashPhrase(PHRASE);
    expect(await verifyPhrase(PHRASE + " wrong", stored)).toBe(false);
  });

  it("uses a random salt (same phrase -> different stored hashes)", async () => {
    expect(await hashPhrase(PHRASE)).not.toBe(await hashPhrase(PHRASE));
  });

  it("produces the documented scrypt$N$r$p$salt$dk shape", async () => {
    const stored = await hashPhrase(PHRASE);
    const parts = stored.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
  });

  it("returns false for malformed stored values", async () => {
    expect(await verifyPhrase(PHRASE, "")).toBe(false);
    expect(await verifyPhrase(PHRASE, "not-a-valid-hash")).toBe(false);
    expect(await verifyPhrase(PHRASE, "scrypt$1$1$1$$")).toBe(false);
  });
});

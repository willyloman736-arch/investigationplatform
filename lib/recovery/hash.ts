// SERVER ONLY — never import in a client component (uses node:crypto).
//
// Hashes the account recovery phrase the same way a password should be hashed:
// scrypt with a per-record random salt. We store ONLY this hash; the recovery
// phrase itself is never persisted, logged, or returned to anyone.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// CPU/memory-hard parameters. N must be a power of two; maxmem must exceed
// ~128*N*r bytes (≈16 MB here), so we allow 64 MB.
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEYLEN = 64;

/** Hash a (normalized) recovery phrase for storage. Format: scrypt$N$r$p$salt$dk */
export async function hashPhrase(phrase: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scryptAsync(phrase.normalize("NFKD"), salt, KEYLEN, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("hex"),
    dk.toString("hex"),
  ].join("$");
}

/** Constant-time verify of a phrase against a previously stored hash. */
export async function verifyPhrase(
  phrase: string,
  stored: string
): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length === 0) return false;
    const dk = await scryptAsync(phrase.normalize("NFKD"), salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
      maxmem: PARAMS.maxmem,
    });
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

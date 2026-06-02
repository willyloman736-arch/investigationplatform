// Recovery-phrase generation + validation. ISOMORPHIC (safe in both client and
// server): uses @scure/bip39 only — no Node APIs — so each user's phrase is
// generated IN THEIR BROWSER and never has to originate on, or be retained by,
// the server.
import { generateMnemonic, validateMnemonic } from "@scure/bip39";
// @scure/bip39 v2 export map requires the explicit ".js" subpath.
import { wordlist } from "@scure/bip39/wordlists/english.js";

export const RECOVERY_WORD_COUNT = 12;

/** Generate a fresh 12-word (128-bit) BIP-39 recovery phrase. */
export function generateRecoveryPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

/** Canonical form used for hashing/verifying: trimmed, single-spaced, lowercase. */
export function normalizeRecoveryPhrase(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when input is a valid 12-word BIP-39 phrase (wordlist + checksum). */
export function validateRecoveryPhrase(input: string): boolean {
  const phrase = normalizeRecoveryPhrase(input);
  if (phrase.split(" ").length !== RECOVERY_WORD_COUNT) return false;
  return validateMnemonic(phrase, wordlist);
}

/** Split a phrase into its individual words (for display). */
export function recoveryPhraseWords(phrase: string): string[] {
  return normalizeRecoveryPhrase(phrase).split(" ");
}

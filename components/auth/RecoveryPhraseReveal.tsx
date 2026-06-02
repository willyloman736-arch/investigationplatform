"use client";

import { useState } from "react";
import { Copy, Check, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { recoveryPhraseWords } from "@/lib/recovery/phrase";
import { APP_NAME } from "@/lib/constants";

/**
 * One-time reveal of a newly created account's recovery phrase. The phrase is
 * generated client-side and only ever lives here (in memory) and in the user's
 * own records — the server stores only a hash. Refreshing loses it, which is why
 * the copy here is emphatic about saving it now.
 */
export function RecoveryPhraseReveal({
  phrase,
  onConfirmed,
}: {
  phrase: string;
  onConfirmed: () => void;
}) {
  const words = recoveryPhraseWords(phrase);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(words.join(" "));
      setCopied(true);
      toast.success("Recovery phrase copied. Store it somewhere safe.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy — please write the phrase down instead.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Save your recovery phrase
        </h2>
        <p className="text-sm text-muted-foreground">
          These 12 words can restore access to your account if you forget your
          password. Write them down in order and keep them somewhere only you can
          reach.
        </p>
      </div>

      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Shown once. Anyone with this phrase can recover your account — never
          share it, and {APP_NAME} staff will never ask for it.
        </span>
      </div>

      <ol
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        aria-label="Your recovery phrase"
      >
        {words.map((word, i) => (
          <li
            key={`${i}-${word}`}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-background/50 px-3 py-2 font-mono text-sm"
          >
            <span className="w-5 select-none text-right text-xs text-muted-foreground/60">
              {i + 1}
            </span>
            <span className="text-foreground">{word}</span>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        className="w-full border-white/15 bg-white/5 hover:bg-white/10"
        onClick={copy}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy phrase"}
      </Button>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-background accent-emerald-500"
        />
        <span>
          I&apos;ve saved my recovery phrase somewhere safe. I understand it
          won&apos;t be shown again.
        </span>
      </label>

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!saved}
        onClick={onConfirmed}
      >
        Continue to dashboard
      </Button>
    </div>
  );
}

export default RecoveryPhraseReveal;

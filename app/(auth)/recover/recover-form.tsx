"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { recoverAccount } from "@/lib/actions/recovery";
import { validateRecoveryPhrase } from "@/lib/recovery/phrase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Account-recovery form. Validates the phrase client-side (BIP-39 checksum)
 * before sending email + phrase + new password to the `recoverAccount` action,
 * which verifies against the stored hash and resets the password.
 */
export function RecoverForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const phrase = String(fd.get("phrase") ?? "");
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirmPassword = String(fd.get("confirmPassword") ?? "");

    const reject = (m: string) => {
      setError(m);
      toast.error(m);
    };

    if (!validateRecoveryPhrase(phrase)) {
      return reject("That doesn't look like a valid 12-word recovery phrase.");
    }
    if (newPassword.length < 8) {
      return reject("Password must be at least 8 characters.");
    }
    if (newPassword !== confirmPassword) {
      return reject("Passwords do not match.");
    }

    setPending(true);
    try {
      const res = await recoverAccount({ email, phrase, newPassword });
      if (!res.success) {
        return reject(res.error ?? "Could not recover the account.");
      }
      toast.success("Password reset. You can now sign in.");
      router.push("/login");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          required
          aria-required="true"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phrase">Recovery phrase</Label>
        <Textarea
          id="phrase"
          name="phrase"
          rows={3}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Enter your 12 words, separated by spaces"
          required
          aria-required="true"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          The 12 words you saved when you created your account.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
          required
          aria-required="true"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Re-enter new password"
          required
          aria-required="true"
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Recovering…
          </>
        ) : (
          <>
            <KeyRound aria-hidden />
            Reset password
          </>
        )}
      </Button>
    </form>
  );
}

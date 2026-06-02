"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client login form. Submits to the `signIn` server action.
 *
 * On success the action redirects (the promise effectively never resolves on
 * the client), so we only ever handle the `{ error }` failure case here.
 */

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          Signing in…
        </>
      ) : (
        <>
          <LogIn aria-hidden />
          Sign in
        </>
      )}
    </Button>
  );
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    setError(null);
    const result = await signIn(formData);
    // Only reached on failure (success redirects).
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <form action={handleAction} className="space-y-5" noValidate>
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/recover"
            className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          aria-required="true"
        />
      </div>

      <SubmitButton />
    </form>
  );
}

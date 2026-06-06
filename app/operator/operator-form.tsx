"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Operator (admin) sign-in form. Uses the same `signIn` server action as the
 * client portal, but passes redirectTo="/admin" so operators land in the command
 * center. Authentication + role enforcement are server-side / middleware — this
 * is only a branded entry point, not a separate auth system.
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
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden />
        </>
      )}
    </Button>
  );
}

export function OperatorForm() {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleAction(formData: FormData) {
    setError(null);
    const result = await signIn(formData);
    // Only reached on failure (success redirects to /admin).
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <form action={handleAction} className="space-y-5" noValidate>
      {/* Operators land in the command center on success. */}
      <input type="hidden" name="redirectTo" value="/admin" />

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
          autoComplete="username"
          inputMode="email"
          placeholder="operator@digitallassetinvestigations.com"
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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            aria-required="true"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

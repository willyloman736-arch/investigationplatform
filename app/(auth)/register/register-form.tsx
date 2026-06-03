"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, UserPlus, Briefcase, Users } from "lucide-react";
import { toast } from "sonner";

import { signUp } from "@/lib/actions/auth";
import { generateRecoveryPhrase } from "@/lib/recovery/phrase";
import { RecoveryPhraseReveal } from "@/components/auth/RecoveryPhraseReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

/**
 * Client registration form. Submits to the `signUp` server action.
 *
 * A 12-word recovery phrase is generated in the browser and sent once with the
 * signup so the server can store only its hash. On success we reveal that phrase
 * (one time) before sending the user to the dashboard.
 *
 * Self-service registration is limited to `client` and `counterparty`.
 */

type SelectableRole = Extract<UserRole, "client" | "counterparty">;

const ROLE_OPTIONS: {
  value: SelectableRole;
  label: string;
  hint: string;
}[] = [
  {
    value: "client",
    label: "Recovery Client",
    hint: "You file a complaint and complete KYC before withdrawal.",
  },
  {
    value: "counterparty",
    label: "Invited Operator",
    hint: "You are invited by the platform to support a recovery file.",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          Creating account…
        </>
      ) : (
        <>
          <UserPlus aria-hidden />
          Create account
        </>
      )}
    </Button>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<SelectableRole>("client");
  const [phrase, setPhrase] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    setError(null);
    // Generate the recovery phrase in the browser and send it once so the server
    // can store only its hash. Keep it in state to reveal after signup succeeds.
    const generated = generateRecoveryPhrase();
    formData.set("recoveryPhrase", generated);

    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    if (result?.success) {
      setPhrase(generated);
    }
  }

  // Once the account is created, reveal the recovery phrase (one time) before
  // continuing. The form is replaced by the reveal step.
  if (phrase) {
    return (
      <RecoveryPhraseReveal
        phrase={phrase}
        onConfirmed={() => router.push("/dashboard")}
      />
    );
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
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Alex Morgan"
          required
          aria-required="true"
        />
      </div>

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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          required
          aria-required="true"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          Use at least 8 characters.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-trigger">Account type</Label>
        {/* Mirror the Radix Select value into a hidden field for the action. */}
        <input type="hidden" name="role" value={role} />
        <Select
          value={role}
          onValueChange={(value) => setRole(value as SelectableRole)}
        >
          <SelectTrigger
            id="role-trigger"
            aria-label="Account type"
            className="auth-trigger"
          >
            <SelectValue placeholder="Select account type" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.value === "client" ? (
                    <Briefcase className="h-4 w-4 text-cyan-300" aria-hidden />
                  ) : (
                    <Users className="h-4 w-4 text-blue-400" aria-hidden />
                  )}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {ROLE_OPTIONS.find((o) => o.value === role)?.hint}
        </p>
      </div>

      <SubmitButton />

      <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
        On the next step you&apos;ll get a one-time recovery phrase — save it to
        regain access if you forget your password.
      </p>

      <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
        KYC review is required before any withdrawal method can be approved.
      </p>

      <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
        Administrator accounts are provisioned by {APP_NAME} staff and cannot be
        self-selected here.
      </p>
    </form>
  );
}

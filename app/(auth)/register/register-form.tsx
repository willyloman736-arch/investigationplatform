"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Handshake,
  Loader2,
  ShieldAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Icon3D, type Icon3DTone } from "@/components/shared/Icon3D";
import { cn } from "@/lib/utils";

/**
 * Client registration form.
 *
 * After the account basics, the user picks one of two intents — "File a case"
 * (a recovery complaint) or "Open an escrow account" — and the relevant fields
 * reveal inline. A 12-word recovery phrase is generated in the browser and sent
 * once so the server stores only its hash; on success it is revealed one time.
 *
 * NOTE (demo): in DEMO mode the extra case/escrow fields are collected and
 * validated but not persisted — wiring them to a real case/escrow record is a
 * server follow-up. The TODO below marks where that hook goes.
 */

type Intent = "file_case" | "open_escrow";

const SCAM_TYPES = [
  { value: "investment", label: "Investment / 'pig butchering'" },
  { value: "romance", label: "Romance scam" },
  { value: "fake_platform", label: "Fake exchange or wallet" },
  { value: "phishing", label: "Phishing / account takeover" },
  { value: "other", label: "Other" },
];

const ESCROW_ROLES = [
  { value: "buyer", label: "Buyer (sending funds)" },
  { value: "seller", label: "Seller (receiving funds)" },
];

const FEE_PAYERS = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "split", label: "Split 50/50" },
];

function SubmitButton({ intent }: { intent: Intent | null }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full"
      size="lg"
      disabled={pending || !intent}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          Creating account…
        </>
      ) : (
        <>
          <UserPlus aria-hidden />
          {intent === "open_escrow"
            ? "Create account & open escrow"
            : intent === "file_case"
              ? "Create account & file case"
              : "Create account"}
        </>
      )}
    </Button>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);

  const [intent, setIntent] = useState<Intent | null>(null);
  const [scamType, setScamType] = useState("investment");
  const [escrowRole, setEscrowRole] = useState("buyer");
  const [feePayer, setFeePayer] = useState("buyer");

  async function handleAction(formData: FormData) {
    setError(null);

    const fail = (m: string) => {
      setError(m);
      toast.error(m);
    };

    if (!intent) return fail("Choose what you'd like to do first.");

    // Light per-intent validation.
    const required: [string, string][] =
      intent === "file_case"
        ? [
            ["amountLost", "Enter the amount lost."],
            ["description", "Briefly describe what happened."],
          ]
        : [
            ["counterpartyEmail", "Enter the counterparty's email."],
            ["dealTitle", "Add a deal title."],
            ["escrowAmount", "Enter the escrow amount."],
          ];
    for (const [name, msg] of required) {
      if (!String(formData.get(name) ?? "").trim()) return fail(msg);
    }

    // Both intents are client accounts; carry the intent + select values.
    formData.set("role", "client");
    formData.set("intent", intent);
    if (intent === "file_case") {
      formData.set("scamType", scamType);
    } else {
      formData.set("escrowRole", escrowRole);
      formData.set("feePayer", feePayer);
    }

    // Generate the recovery phrase in the browser; send once for hashing.
    const generated = generateRecoveryPhrase();
    formData.set("recoveryPhrase", generated);

    // TODO(server): persist the case / escrow record from these fields after the
    // account is created. In DEMO mode signUp succeeds without a database.
    const result = await signUp(formData);
    if (result?.error) return fail(result.error);
    if (result?.success) {
      toast.success(
        intent === "open_escrow"
          ? "Account created — escrow request captured."
          : "Account created — case details captured."
      );
      setPhrase(generated);
    }
  }

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

      {/* Account basics */}
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
        <Label htmlFor="email">Email address</Label>
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

      {/* Intent chooser */}
      <div className="space-y-2">
        <Label>What would you like to do?</Label>
        <div
          role="radiogroup"
          aria-label="What would you like to do?"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <IntentCard
            active={intent === "file_case"}
            onClick={() => setIntent("file_case")}
            icon={ShieldAlert}
            tone="red"
            title="File a case"
            hint="Report a crypto scam and start recovery."
          />
          <IntentCard
            active={intent === "open_escrow"}
            onClick={() => setIntent("open_escrow")}
            icon={Handshake}
            tone="emerald"
            title="Open an escrow account"
            hint="Hold funds safely for a deal."
          />
        </div>
      </div>

      {intent === "file_case" ? (
        <FileCaseFields scamType={scamType} setScamType={setScamType} />
      ) : null}

      {intent === "open_escrow" ? (
        <OpenEscrowFields
          escrowRole={escrowRole}
          setEscrowRole={setEscrowRole}
          feePayer={feePayer}
          setFeePayer={setFeePayer}
        />
      ) : null}

      <SubmitButton intent={intent} />

      <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
        On the next step you&apos;ll get a one-time recovery phrase — save it to
        regain access if you forget your password.
      </p>
    </form>
  );
}

function IntentCard({
  active,
  onClick,
  icon,
  tone,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  tone: Icon3DTone;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/60 bg-primary/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      )}
    >
      <Icon3D icon={icon} tone={tone} size={36} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}

function FileCaseFields({
  scamType,
  setScamType,
}: {
  scamType: string;
  setScamType: (v: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <input type="hidden" name="scamType" value={scamType} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scamType-trigger">Type of scam</Label>
          <Select value={scamType} onValueChange={setScamType}>
            <SelectTrigger
              id="scamType-trigger"
              className="auth-trigger"
              aria-label="Type of scam"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCAM_TYPES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amountLost">Amount lost (USD)</Label>
          <Input
            id="amountLost"
            name="amountLost"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incidentDate">Date of incident</Label>
          <Input id="incidentDate" name="incidentDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="asset">Asset involved</Label>
          <Input id="asset" name="asset" placeholder="BTC, ETH, USDT…" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="platform">Where it happened</Label>
        <Input
          id="platform"
          name="platform"
          placeholder="Platform, website, or person"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="walletTx">Wallet address(es) / transaction hash(es)</Label>
        <Textarea
          id="walletTx"
          name="walletTx"
          className="min-h-[72px] font-mono text-xs"
          placeholder="0x… addresses or tx hashes, one per line"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">What happened?</Label>
        <Textarea
          id="description"
          name="description"
          className="min-h-[88px]"
          placeholder="Briefly describe the scam and the timeline."
          required
        />
      </div>

      <p className="text-xs text-muted-foreground">
        You&apos;ll upload evidence (screenshots, receipts, chat logs) inside your
        case after signup.
      </p>
    </div>
  );
}

function OpenEscrowFields({
  escrowRole,
  setEscrowRole,
  feePayer,
  setFeePayer,
}: {
  escrowRole: string;
  setEscrowRole: (v: string) => void;
  feePayer: string;
  setFeePayer: (v: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <input type="hidden" name="escrowRole" value={escrowRole} />
      <input type="hidden" name="feePayer" value={feePayer} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="escrowRole-trigger">Your role</Label>
          <Select value={escrowRole} onValueChange={setEscrowRole}>
            <SelectTrigger
              id="escrowRole-trigger"
              className="auth-trigger"
              aria-label="Your role"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESCROW_ROLES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="counterpartyEmail">Counterparty email</Label>
          <Input
            id="counterpartyEmail"
            name="counterpartyEmail"
            type="email"
            inputMode="email"
            placeholder="them@example.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dealTitle">Deal title</Label>
        <Input
          id="dealTitle"
          name="dealTitle"
          placeholder="e.g. 2008 BMW 328xi"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dealDescription">Description</Label>
        <Textarea
          id="dealDescription"
          name="dealDescription"
          className="min-h-[72px]"
          placeholder="What's being bought or sold, and the terms."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="escrowAmount">Amount (USD)</Label>
          <Input
            id="escrowAmount"
            name="escrowAmount"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="feePayer-trigger">Fee paid by</Label>
          <Select value={feePayer} onValueChange={setFeePayer}>
            <SelectTrigger
              id="feePayer-trigger"
              className="auth-trigger"
              aria-label="Fee paid by"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEE_PAYERS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inspectionDays">Inspection (days)</Label>
          <Input
            id="inspectionDays"
            name="inspectionDays"
            inputMode="numeric"
            placeholder="3"
            defaultValue="3"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  IdCard,
  Loader2,
  ShieldCheck,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { submitKycSubmission } from "@/lib/actions/kyc";
import {
  KYC_ID_TYPE_LABELS,
  KYC_PROOF_TYPE_LABELS,
  KYC_STATUS_BADGE_VARIANTS,
  KYC_STATUS_LABELS,
} from "@/lib/constants";
import type {
  KycIdType,
  KycProofType,
  KycStatus,
  KycSubmissionWithProfile,
  Profile,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

interface KycWizardProps {
  profile: Profile;
  latestSubmission: KycSubmissionWithProfile | null;
}

interface FormState {
  fullLegalName: string;
  dateOfBirth: string;
  nationality: string;
  residentialAddress: string;
  phone: string;
  email: string;
  idType: KycIdType;
  idNumber: string;
  issuingCountry: string;
  idExpiryDate: string;
  proofType: KycProofType;
}

interface FileState {
  idFront: File | null;
  idBack: File | null;
  selfie: File | null;
  proofOfAddress: File | null;
}

const STEPS = [
  {
    title: "Personal Information",
    description: "Legal identity and contact details for your recovery file.",
    icon: UserRound,
  },
  {
    title: "Government ID Upload",
    description: "Passport, driver's license, or national ID.",
    icon: IdCard,
  },
  {
    title: "Selfie Verification",
    description: "Upload a clear selfie that matches your government ID.",
    icon: ShieldCheck,
  },
  {
    title: "Proof of Address",
    description: "Utility bill, bank statement, lease, or tax document.",
    icon: FileText,
  },
  {
    title: "Submit for Review",
    description: "Confirm and send your KYC package for verification.",
    icon: CheckCircle2,
  },
] as const;

function initialState(profile: Profile, latest: KycSubmissionWithProfile | null): FormState {
  return {
    fullLegalName: latest?.full_legal_name ?? profile.full_name ?? "",
    dateOfBirth: latest?.date_of_birth ?? "",
    nationality: latest?.nationality ?? "",
    residentialAddress: latest?.residential_address ?? "",
    phone: latest?.phone ?? profile.phone ?? "",
    email: latest?.email ?? profile.email ?? "",
    idType: latest?.id_type ?? "passport",
    idNumber: "",
    issuingCountry: latest?.issuing_country ?? "",
    idExpiryDate: latest?.id_expiry_date ?? "",
    proofType: latest?.proof_type ?? "utility_bill",
  };
}

function canStartNewSubmission(status: KycStatus): boolean {
  return (
    status === "not_started" ||
    status === "declined" ||
    status === "rejected" ||
    status === "resubmission_required"
  );
}

function fileName(file: File | null): string {
  return file ? file.name : "No file selected";
}

export function KycWizard({ profile, latestSubmission }: KycWizardProps) {
  const router = useRouter();
  const latestStatus = latestSubmission?.status ?? profile.kyc_status ?? "not_started";
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>(() =>
    initialState(profile, latestSubmission)
  );
  const [files, setFiles] = React.useState<FileState>({
    idFront: null,
    idBack: null,
    selfie: null,
    proofOfAddress: null,
  });
  const [isPending, startTransition] = React.useTransition();

  const locked =
    latestStatus === "verified" || latestStatus === "pending_review" || latestStatus === "in_review";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateFile<K extends keyof FileState>(key: K, value: File | null) {
    setFiles((prev) => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function prevStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      if (files.idFront) formData.append("idFront", files.idFront);
      if (files.idBack) formData.append("idBack", files.idBack);
      if (files.selfie) formData.append("selfie", files.selfie);
      if (files.proofOfAddress) {
        formData.append("proofOfAddress", files.proofOfAddress);
      }

      const result = await submitKycSubmission(formData);
      if (!result.success) {
        toast.error(result.error ?? "Could not submit KYC.");
        return;
      }

      toast.success("KYC submitted for review.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Required verification
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Verify Your Identity
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Complete identity verification once your recovery profile is
              created. Verification is required before escrow transfer options
              become available.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-background/35 p-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Current status
                </p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {latestStatus === "verified"
                    ? "Identity Verified"
                    : KYC_STATUS_LABELS[latestStatus]}
                </p>
              </div>
              <Badge variant={KYC_STATUS_BADGE_VARIANTS[latestStatus]}>
                {KYC_STATUS_LABELS[latestStatus]}
              </Badge>
            </div>
            {latestSubmission ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Last submitted {formatDate(latestSubmission.created_at)}.
                {latestSubmission.admin_notes
                  ? ` Note: ${latestSubmission.admin_notes}`
                  : ""}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No identity package has been submitted yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {latestStatus === "verified" ? (
        <Alert variant="success" className="rounded-2xl backdrop-blur-xl">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Identity Verified</AlertTitle>
          <AlertDescription>
            Your profile is verified. Transfer requests remain available only
            when escrow release requirements are satisfied.
          </AlertDescription>
        </Alert>
      ) : latestStatus === "pending_review" || latestStatus === "in_review" ? (
        <Alert variant="info" className="rounded-2xl backdrop-blur-xl">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Verification in review</AlertTitle>
          <AlertDescription>
            Your KYC package is queued for verification. You will see the status
            update here and on your profile when review is complete.
          </AlertDescription>
        </Alert>
      ) : latestStatus !== "not_started" ? (
        <Alert variant="warning" className="rounded-2xl backdrop-blur-xl">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{KYC_STATUS_LABELS[latestStatus]}</AlertTitle>
          <AlertDescription>
            {latestSubmission?.admin_notes ||
              "Please submit an updated verification package to continue."}
          </AlertDescription>
        </Alert>
      ) : null}

      {canStartNewSubmission(latestStatus) ? (
        <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl sm:p-4">
            <div className="space-y-2">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const active = index === step;
                const done = index < step;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setStep(index)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-primary/25 bg-primary/15 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.04]"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                        done
                          ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25"
                          : active
                          ? "bg-primary/15 text-primary ring-primary/25"
                          : "bg-white/5 text-muted-foreground ring-white/10"
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                {STEPS[step].title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {STEPS[step].description}
              </p>
            </div>

            {step === 0 ? (
              <PersonalStep form={form} update={update} />
            ) : step === 1 ? (
              <GovernmentIdStep
                form={form}
                files={files}
                update={update}
                updateFile={updateFile}
              />
            ) : step === 2 ? (
              <SelfieStep files={files} updateFile={updateFile} />
            ) : step === 3 ? (
              <AddressStep
                form={form}
                files={files}
                update={update}
                updateFile={updateFile}
              />
            ) : (
              <ReviewStep form={form} files={files} />
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={step === 0 || isPending}
                className="h-11 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>

              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={nextStep} className="h-11 rounded-xl">
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="h-11 rounded-xl shadow-2xl shadow-primary/20"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  Submit for Review
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : locked ? null : null}
    </section>
  );
}

function PersonalStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full legal name" id="fullLegalName" className="sm:col-span-2">
        <Input
          id="fullLegalName"
          value={form.fullLegalName}
          onChange={(event) => update("fullLegalName", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <Field label="Date of birth" id="dateOfBirth">
        <Input
          id="dateOfBirth"
          type="date"
          value={form.dateOfBirth}
          onChange={(event) => update("dateOfBirth", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <Field label="Nationality" id="nationality">
        <Input
          id="nationality"
          value={form.nationality}
          onChange={(event) => update("nationality", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <Field label="Residential address" id="residentialAddress" className="sm:col-span-2">
        <Textarea
          id="residentialAddress"
          value={form.residentialAddress}
          onChange={(event) => update("residentialAddress", event.target.value)}
          className="min-h-[92px] rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <Field label="Phone" id="phone">
        <Input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(event) => update("phone", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <Field label="Email" id="email">
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
    </div>
  );
}

function GovernmentIdStep({
  form,
  files,
  update,
  updateFile,
}: {
  form: FormState;
  files: FileState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  updateFile: <K extends keyof FileState>(key: K, value: File | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label>ID type</Label>
        <Select value={form.idType} onValueChange={(value) => update("idType", value as KycIdType)}>
          <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-background/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KYC_ID_TYPE_LABELS) as KycIdType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {KYC_ID_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Field label="ID number" id="idNumber">
        <Input
          id="idNumber"
          value={form.idNumber}
          onChange={(event) => update("idNumber", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <Field label="Issuing country" id="issuingCountry">
        <Input
          id="issuingCountry"
          value={form.issuingCountry}
          onChange={(event) => update("issuingCountry", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <Field label="Expiry date" id="idExpiryDate">
        <Input
          id="idExpiryDate"
          type="date"
          value={form.idExpiryDate}
          onChange={(event) => update("idExpiryDate", event.target.value)}
          className="h-11 rounded-xl border-white/10 bg-background/40"
          required
        />
      </Field>
      <UploadBox
        label="Front of government ID"
        file={files.idFront}
        onChange={(file) => updateFile("idFront", file)}
      />
      <UploadBox
        label={form.idType === "passport" ? "Back of ID (optional)" : "Back of government ID"}
        file={files.idBack}
        onChange={(file) => updateFile("idBack", file)}
      />
    </div>
  );
}

function SelfieStep({
  files,
  updateFile,
}: {
  files: FileState;
  updateFile: <K extends keyof FileState>(key: K, value: File | null) => void;
}) {
  return (
    <div className="space-y-4">
      <Alert variant="info" className="rounded-2xl">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Selfie instruction</AlertTitle>
        <AlertDescription>
          Upload a clear selfie that matches your government ID.
        </AlertDescription>
      </Alert>
      <UploadBox
        label="Selfie image"
        file={files.selfie}
        onChange={(file) => updateFile("selfie", file)}
      />
    </div>
  );
}

function AddressStep({
  form,
  files,
  update,
  updateFile,
}: {
  form: FormState;
  files: FileState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  updateFile: <K extends keyof FileState>(key: K, value: File | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Document type</Label>
        <Select
          value={form.proofType}
          onValueChange={(value) => update("proofType", value as KycProofType)}
        >
          <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-background/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KYC_PROOF_TYPE_LABELS) as KycProofType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {KYC_PROOF_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <UploadBox
        label="Proof of address"
        file={files.proofOfAddress}
        onChange={(file) => updateFile("proofOfAddress", file)}
        className="sm:col-span-2"
      />
    </div>
  );
}

function ReviewStep({ form, files }: { form: FormState; files: FileState }) {
  const items = [
    ["Legal name", form.fullLegalName],
    ["Date of birth", form.dateOfBirth],
    ["Nationality", form.nationality],
    ["Phone", form.phone],
    ["Email", form.email],
    ["ID type", KYC_ID_TYPE_LABELS[form.idType]],
    ["ID number", form.idNumber ? "Provided" : "Missing"],
    ["Issuing country", form.issuingCountry],
    ["ID front", fileName(files.idFront)],
    ["ID back", fileName(files.idBack)],
    ["Selfie", fileName(files.selfie)],
    ["Address document", fileName(files.proofOfAddress)],
  ];

  return (
    <div className="grid gap-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-background/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </span>
          <span className="break-words text-sm font-medium text-foreground sm:text-right">
            {value || "Missing"}
          </span>
        </div>
      ))}
    </div>
  );
}

function UploadBox({
  label,
  file,
  onChange,
  className,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  className?: string;
}) {
  const inputId = React.useId();
  return (
    <div className={className}>
      <Label htmlFor={inputId}>{label}</Label>
      <label
        htmlFor={inputId}
        className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-background/35 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.06]"
      >
        <UploadCloud className="h-7 w-7 text-primary" aria-hidden="true" />
        <span className="mt-2 text-sm font-semibold text-foreground">
          {file ? "File selected" : "Upload JPG, PNG, or PDF"}
        </span>
        <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">
          {fileName(file)}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function Field({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

export default KycWizard;

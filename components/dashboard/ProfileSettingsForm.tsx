"use client";

import * as React from "react";
import { Camera, Loader2, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/actions/profile";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProfileSettingsFormProps {
  profile: Profile;
}

function initialsFrom(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DA";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function ProfileSettingsForm({ profile }: ProfileSettingsFormProps) {
  const [fullName, setFullName] = React.useState(profile.full_name ?? "");
  const [company, setCompany] = React.useState(profile.company ?? "");
  const [phone, setPhone] = React.useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_url ?? "");
  const [isPending, startTransition] = React.useTransition();

  const initials = initialsFrom(fullName, profile.email);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateProfile({
        fullName,
        company,
        phone,
        avatarUrl,
      });

      if (result.success) {
        toast.success("Profile updated.");
      } else {
        toast.error(result.error ?? "Could not update profile.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar className="h-24 w-24 border border-white/15 shadow-2xl shadow-black/25">
              <AvatarImage src={avatarUrl || undefined} alt={fullName || "Profile"} />
              <AvatarFallback className="bg-primary/15 text-2xl font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-background/90 text-primary shadow-lg shadow-black/25 backdrop-blur-xl">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Profile photo
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              Make your account recognizable
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Add a hosted image URL for now. The photo appears in the dashboard
              header and account menu.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Label htmlFor="avatarUrl">Profile picture URL</Label>
          <Input
            id="avatarUrl"
            type="url"
            inputMode="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://example.com/profile-photo.jpg"
            className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Personal details
              </h2>
              <p className="text-sm text-muted-foreground">
                Name, organization, and contact details used by your recovery file.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="fullName">Display name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
                required
              />
            </div>
            <div>
              <Label htmlFor="company">Company or organization</Label>
              <Input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Optional"
                className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 000 0000"
                className="mt-2 h-11 rounded-xl border-white/10 bg-background/40"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Email address</Label>
              <Input
                value={profile.email}
                className="mt-2 h-11 rounded-xl border-white/10 bg-background/30 text-muted-foreground"
                disabled
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Email changes are handled through account security verification.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 backdrop-blur-xl sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/25">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Account role
                </p>
                <p className="text-sm capitalize text-emerald-200">
                  {profile.role}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Your profile connects recovery cases, escrow accounts, evidence
              uploads, receipts, and admin updates to the same verified account.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:p-5">
            <p className="text-sm font-semibold text-foreground">
              Professional profile checklist
            </p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <ChecklistItem done={Boolean(fullName.trim())} label="Display name" />
              <ChecklistItem done={Boolean(phone.trim())} label="Phone contact" />
              <ChecklistItem done={Boolean(avatarUrl.trim())} label="Profile photo" />
              <ChecklistItem done={Boolean(company.trim())} label="Organization" />
            </div>
          </div>
        </aside>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending}
          className="h-11 rounded-xl px-5 shadow-2xl shadow-primary/20"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          Save profile
        </Button>
      </div>
    </form>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          done ? "bg-emerald-300" : "bg-muted-foreground/40"
        )}
      />
      <span>{label}</span>
    </div>
  );
}

export default ProfileSettingsForm;

"use client";

import * as React from "react";
import { ExternalLink, Eye, FileText, Image as ImageIcon, Lock } from "lucide-react";

import type { KycDocumentSignedUrls, KycSubmission } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface KycDocumentPreviewGridProps {
  submission: KycSubmission;
  signedUrls: KycDocumentSignedUrls;
}

type DocKey = keyof KycDocumentSignedUrls;

const DOCS: Array<{ key: DocKey; label: string; pathKey: keyof KycSubmission }> = [
  { key: "id_front_url", label: "Government ID Front", pathKey: "id_front_url" },
  { key: "id_back_url", label: "Government ID Back", pathKey: "id_back_url" },
  { key: "selfie_url", label: "Selfie Verification", pathKey: "selfie_url" },
  {
    key: "proof_of_address_url",
    label: "Proof of Address",
    pathKey: "proof_of_address_url",
  },
];

function isPdf(url: string | null, path: unknown): boolean {
  const source = `${url ?? ""} ${typeof path === "string" ? path : ""}`.toLowerCase();
  return source.includes(".pdf");
}

export function KycDocumentPreviewGrid({
  submission,
  signedUrls,
}: KycDocumentPreviewGridProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Secure documents
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Review uploaded files
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Private KYC files are opened with short-lived signed links generated
          server-side.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {DOCS.map((doc) => {
          const url = signedUrls[doc.key];
          const path = submission[doc.pathKey];
          const pdf = isPdf(url, path);
          const Icon = pdf ? FileText : ImageIcon;

          return (
            <Dialog key={doc.key}>
              <div className="rounded-2xl border border-white/10 bg-background/35 p-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                    {path ? (
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{doc.label}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {typeof path === "string" && path ? path : "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!url}
                      className="flex-1 rounded-xl"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Preview
                    </Button>
                  </DialogTrigger>
                  {url ? (
                    <Button asChild size="sm" variant="ghost" className="rounded-xl">
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>

              <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{doc.label}</DialogTitle>
                  <DialogDescription>
                    Signed document preview. Links expire automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="h-[70vh] overflow-hidden rounded-2xl border border-white/10 bg-background/60">
                  {url && pdf ? (
                    <iframe
                      src={url}
                      title={doc.label}
                      className="h-full w-full"
                    />
                  ) : url ? (
                    <div className="flex h-full items-center justify-center p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={doc.label}
                        className="max-h-full max-w-full rounded-xl object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Signed preview is unavailable.
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    </section>
  );
}

export default KycDocumentPreviewGrid;

"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FileUploader — drag & drop evidence uploader (client component).
//
// Validates file type against ACCEPTED_FILE_TYPES_COMBINED and size against
// MAX_FILE_SIZE BEFORE anything is sent, lets the user categorize + annotate each
// staged file, then calls the `uploadFile` server action (FormData) per file.
//
// Honest copy only: we never claim files are encrypted at rest unless the
// provider/storage layer actually does it. Mutations go through the server action.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useCallback, useState, useTransition } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileImage,
  Hash,
  MessageSquareText,
  File as FileIcon,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  ACCEPTED_FILE_TYPES_COMBINED,
  FILE_CATEGORY_LABELS,
  MAX_FILE_SIZE,
} from "@/lib/constants";
import type { FileCategory } from "@/lib/types";
import { uploadFile } from "@/lib/actions/files";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FileUploaderProps {
  caseId: string;
  /** Called after at least one file uploads successfully (e.g. to refresh). */
  onUploaded?: () => void;
  className?: string;
}

/** A file staged locally, awaiting categorization + upload. */
interface StagedFile {
  id: string;
  file: File;
  category: FileCategory;
  notes: string;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
}

const FILE_CATEGORY_ORDER: FileCategory[] = [
  "csv",
  "pdf_receipt",
  "image_receipt",
  "chat_log",
  "text",
  "tx_hash",
  "other",
];

/** Human readable byte size. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Guess a sensible default category from the file's mime/extension. */
function guessCategory(file: File): FileCategory {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (type === "text/csv" || name.endsWith(".csv")) return "csv";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf_receipt";
  if (type.startsWith("image/")) return "image_receipt";
  if (name.endsWith(".log") || name.endsWith(".json")) return "chat_log";
  if (name.endsWith(".md") || name.endsWith(".txt")) return "text";
  return "other";
}

function categoryIcon(category: FileCategory) {
  switch (category) {
    case "csv":
      return FileSpreadsheet;
    case "pdf_receipt":
      return FileText;
    case "image_receipt":
      return FileImage;
    case "chat_log":
      return MessageSquareText;
    case "text":
      return FileText;
    case "tx_hash":
      return Hash;
    default:
      return FileIcon;
  }
}

let stagedCounter = 0;

export function FileUploader({
  caseId,
  onUploaded,
  className,
}: FileUploaderProps) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [isPending, startTransition] = useTransition();

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      rejections.forEach((rej) => {
        const reason = rej.errors[0];
        if (reason?.code === "file-too-large") {
          toast.error(`${rej.file.name} exceeds the ${formatBytes(MAX_FILE_SIZE)} limit.`);
        } else if (reason?.code === "file-invalid-type") {
          toast.error(`${rej.file.name} is not an accepted evidence type.`);
        } else {
          toast.error(`${rej.file.name} could not be added.`);
        }
      });

      if (accepted.length > 0) {
        setStaged((prev) => [
          ...prev,
          ...accepted.map((file) => ({
            id: `staged-${stagedCounter++}`,
            file,
            category: guessCategory(file),
            notes: "",
            status: "idle" as const,
          })),
        ]);
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES_COMBINED,
      maxSize: MAX_FILE_SIZE,
      multiple: true,
    });

  function updateStaged(id: string, patch: Partial<StagedFile>) {
    setStaged((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function removeStaged(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  function handleUploadAll() {
    const pending = staged.filter((s) => s.status === "idle" || s.status === "error");
    if (pending.length === 0) {
      toast.info("No files staged to upload.");
      return;
    }

    startTransition(async () => {
      let successes = 0;
      for (const item of pending) {
        updateStaged(item.id, { status: "uploading", error: undefined });
        try {
          const formData = new FormData();
          formData.append("caseId", caseId);
          formData.append("file", item.file);
          formData.append("file_type", item.category);
          formData.append("notes", item.notes);

          const result = await uploadFile(formData);
          if (result?.success === false) {
            updateStaged(item.id, {
              status: "error",
              error: result.error ?? "Upload failed.",
            });
            toast.error(`${item.file.name}: ${result.error ?? "Upload failed."}`);
          } else {
            updateStaged(item.id, { status: "done" });
            successes += 1;
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Upload failed.";
          updateStaged(item.id, { status: "error", error: message });
          toast.error(`${item.file.name}: ${message}`);
        }
      }

      if (successes > 0) {
        toast.success(
          successes === 1
            ? "Evidence uploaded and logged to the case."
            : `${successes} files uploaded and logged to the case.`
        );
        onUploaded?.();
      }
    });
  }

  const hasUploadable = staged.some(
    (s) => s.status === "idle" || s.status === "error"
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center backdrop-blur-md transition-colors",
          "hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragActive && "border-primary/60 bg-primary/10",
          isDragReject && "border-destructive/60 bg-destructive/10"
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload evidence files"
      >
        <input {...getInputProps()} />
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {isDragActive
            ? "Drop files to stage them"
            : "Drag & drop evidence, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Max {formatBytes(MAX_FILE_SIZE)} per file. Files are validated before
          upload.
        </p>
        <p className="mt-3 max-w-md text-[11px] leading-relaxed text-muted-foreground">
          Accepted: CSV / spreadsheets, PDF receipts, image receipts (PNG / JPG /
          WEBP), chat logs (.txt / .log / .json), text notes, and blockchain
          transaction hash text.
        </p>
      </div>

      {/* Honest storage disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Uploaded evidence is associated with this case and visible to its
          parties and assigned administrators. Every upload is recorded in the
          case audit log.
        </span>
      </div>

      {/* Staged files */}
      {staged.length > 0 && (
        <ul className="space-y-3">
          {staged.map((item) => {
            const Icon = categoryIcon(item.category);
            return (
              <li
                key={item.id}
                className="rounded-xl border border-white/10 bg-card/60 p-3 backdrop-blur-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
                    {item.status === "uploading" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : item.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(item.file.size)}
                          {item.status === "done" && " · Uploaded"}
                          {item.status === "error" && (
                            <span className="text-destructive">
                              {" "}
                              · {item.error ?? "Failed"}
                            </span>
                          )}
                        </p>
                      </div>
                      {item.status !== "uploading" && item.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => removeStaged(item.id)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {item.status !== "done" && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`category-${item.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            Evidence type
                          </Label>
                          <Select
                            value={item.category}
                            onValueChange={(value) =>
                              updateStaged(item.id, {
                                category: value as FileCategory,
                              })
                            }
                            disabled={item.status === "uploading"}
                          >
                            <SelectTrigger
                              id={`category-${item.id}`}
                              className="h-9"
                            >
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {FILE_CATEGORY_ORDER.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {FILE_CATEGORY_LABELS[cat]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`notes-${item.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            Notes{" "}
                            <span className="font-normal">(optional)</span>
                          </Label>
                          <Textarea
                            id={`notes-${item.id}`}
                            value={item.notes}
                            onChange={(e) =>
                              updateStaged(item.id, { notes: e.target.value })
                            }
                            disabled={item.status === "uploading"}
                            placeholder="Context for this evidence (e.g. transaction date, source)…"
                            className="min-h-[40px]"
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasUploadable && (
        <div className="flex justify-end">
          <Button onClick={handleUploadAll} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Upload evidence
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default FileUploader;

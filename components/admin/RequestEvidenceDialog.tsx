"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RequestEvidenceDialog — admin asks a party for additional evidence.
//
// Requires a non-empty note before calling the `requestEvidence` server action.
// The trigger is provided by the caller (asChild) so it can sit in a menu, a
// button row, etc.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useState, useTransition } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { PartyRole } from "@/lib/types";
import { requestEvidence } from "@/lib/actions/admin";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface RequestEvidenceDialogProps {
  caseId: string;
  /** Custom trigger element. Falls back to a default outline button. */
  children?: React.ReactNode;
  defaultParty?: Extract<PartyRole, "party_a" | "party_b">;
}

export function RequestEvidenceDialog({
  caseId,
  children,
  defaultParty = "party_a",
}: RequestEvidenceDialogProps) {
  const [open, setOpen] = useState(false);
  const [party, setParty] =
    useState<Extract<PartyRole, "party_a" | "party_b">>(defaultParty);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error("A note describing the requested evidence is required.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await requestEvidence({ caseId, party, note: trimmed });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not send the request.");
        } else {
          toast.success("Evidence request sent and logged to the case.");
          setNote("");
          setOpen(false);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not send the request."
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <FileSearch className="h-4 w-4" />
            Request evidence
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            Request additional evidence
          </DialogTitle>
          <DialogDescription>
            Ask a party to supply more documentation. This request is recorded in
            the case audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="evidence-party">Request from</Label>
            <Select
              value={party}
              onValueChange={(v) =>
                setParty(v as Extract<PartyRole, "party_a" | "party_b">)
              }
            >
              <SelectTrigger id="evidence-party">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="party_a">Party A</SelectItem>
                <SelectItem value="party_b">Party B</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evidence-note">
              What is needed <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="evidence-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please upload the signed delivery receipt and the bank confirmation for the deposit."
              className="min-h-[110px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || note.trim().length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RequestEvidenceDialog;

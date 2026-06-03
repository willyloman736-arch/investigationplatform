"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CaseManagementTable — admin case roster (client component).
//
// For each case: a status dropdown (calls updateCaseStatus), an "Assign parties"
// dialog (calls assignParties, both emails required), and a link into the admin
// case detail. Status changes are admin-only and audited server-side.
//
// Wrapped in overflow-x-auto so the table scrolls inside its card on mobile
// rather than overflowing the page.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  Loader2,
  MoreHorizontal,
  Users,
  FolderKanban,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { CASE_STATUS_CONFIG } from "@/lib/constants";
import type { CaseStatus, CaseWithRelations } from "@/lib/types";
import { updateCaseStatus, assignParties } from "@/lib/actions/cases";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CaseManagementTableProps {
  cases: CaseWithRelations[];
  className?: string;
}

const STATUS_OPTIONS: CaseStatus[] = [
  "draft",
  "active",
  "suspended",
  "closed",
  "under_dispute",
];

function CaseStatusPill({ status }: { status: CaseStatus }) {
  const config = CASE_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        config.badgeClass
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      {config.label}
    </span>
  );
}

function partyEmail(
  c: CaseWithRelations,
  role: "party_a" | "party_b"
): string {
  const p = c.parties?.find((x) => x.party_role === role);
  return p?.invited_email ?? "";
}

export function CaseManagementTable({
  cases,
  className,
}: CaseManagementTableProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Assign-parties dialog state.
  const [assignFor, setAssignFor] = useState<CaseWithRelations | null>(null);
  const [emailA, setEmailA] = useState("");
  const [emailB, setEmailB] = useState("");
  const [assigning, startAssign] = useTransition();

  function handleStatusChange(caseId: string, status: CaseStatus) {
    setPendingId(caseId);
    startTransition(async () => {
      try {
        const result = await updateCaseStatus({ caseId, status });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not update case status.");
        } else {
          toast.success(`Case moved to ${CASE_STATUS_CONFIG[status].label}.`);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update case status."
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function openAssign(c: CaseWithRelations) {
    setAssignFor(c);
    setEmailA(partyEmail(c, "party_a"));
    setEmailB(partyEmail(c, "party_b"));
  }

  function handleAssign() {
    if (!assignFor) return;
    if (!emailA.trim() || !emailB.trim()) {
      toast.error("Both client and operator emails are required.");
      return;
    }
    const caseId = assignFor.id;
    startAssign(async () => {
      try {
        const result = await assignParties({
          caseId,
          partyAEmail: emailA.trim(),
          partyBEmail: emailB.trim(),
        });
        if (result?.success === false) {
          toast.error(result.error ?? "Could not assign parties.");
        } else {
          toast.success("Parties assigned and invited.");
          setAssignFor(null);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not assign parties."
        );
      }
    });
  }

  if (!cases || cases.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-card/60 px-6 py-12 text-center backdrop-blur-md",
          className
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-muted-foreground">
          <FolderKanban className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">No cases yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Created cases will appear here for assignment and management.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md",
          className
        )}
      >
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="whitespace-nowrap">Case</TableHead>
                <TableHead className="whitespace-nowrap">Category</TableHead>
                <TableHead className="whitespace-nowrap">Parties</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Set status</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => {
                const busy = isPending && pendingId === c.id;
                const aEmail = partyEmail(c, "party_a");
                const bEmail = partyEmail(c, "party_b");
                return (
                  <TableRow key={c.id} className="border-white/5">
                    <TableCell className="max-w-[260px]">
                      <Link
                        href={`/admin/cases/${c.id}`}
                        className="group block"
                      >
                        <span className="block font-mono text-xs text-muted-foreground">
                          {c.case_number}
                        </span>
                        <span className="block truncate font-medium text-foreground group-hover:text-primary">
                          {c.title}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {c.category || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {aEmail || bEmail ? (
                        <div className="space-y-0.5">
                          <div className="truncate">
                            <span className="text-foreground/70">Client:</span>{" "}
                            {aEmail || "—"}
                          </div>
                          <div className="truncate">
                            <span className="text-foreground/70">Operator:</span>{" "}
                            {bEmail || "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <CaseStatusPill status={c.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Select
                          value={c.status}
                          onValueChange={(v) =>
                            handleStatusChange(c.id, v as CaseStatus)
                          }
                          disabled={busy}
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {CASE_STATUS_CONFIG[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {busy && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${c.case_number}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/cases/${c.id}`}>
                              <ArrowRight className="h-4 w-4" />
                              Open case
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openAssign(c)}>
                            <Users className="h-4 w-4" />
                            Assign client/operator
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              handleStatusChange(c.id, "suspended")
                            }
                            disabled={c.status === "suspended"}
                          >
                            Suspend case
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleStatusChange(c.id, "closed")}
                            disabled={c.status === "closed"}
                            className="text-muted-foreground"
                          >
                            Close case
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Assign parties dialog */}
      <Dialog
        open={assignFor !== null}
        onOpenChange={(o) => !o && setAssignFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Assign client/operator
            </DialogTitle>
            <DialogDescription>
              {assignFor
                ? `Invite the client and operator to ${assignFor.case_number}. Existing users gain access immediately; others receive an invitation.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="assign-a">
                Client email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="assign-a"
                type="email"
                value={emailA}
                onChange={(e) => setEmailA(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assign-b">
                Operator email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="assign-b"
                type="email"
                value={emailB}
                onChange={(e) => setEmailB(e.target.value)}
                placeholder="operator@example.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAssignFor(null)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={
                assigning || !emailA.trim() || !emailB.trim()
              }
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning…
                </>
              ) : (
                "Assign client/operator"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CaseManagementTable;

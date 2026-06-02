"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Case } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CaseSelectorProps {
  cases: Case[];
  /** Currently selected case id (e.g. from the route params). */
  selectedId?: string;
  className?: string;
}

/**
 * Quick case switcher. On selection it navigates to the case detail route.
 * Used in dashboard headers so users can jump between their cases without going
 * back to the list.
 */
export function CaseSelector({
  cases,
  selectedId,
  className,
}: CaseSelectorProps) {
  const router = useRouter();

  const handleChange = React.useCallback(
    (id: string) => {
      if (!id || id === selectedId) return;
      router.push(`/dashboard/cases/${id}`);
    },
    [router, selectedId]
  );

  if (cases.length === 0) {
    return (
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border border-input bg-white/5 px-3 text-sm text-muted-foreground",
          className
        )}
      >
        <FolderKanban className="h-4 w-4" aria-hidden="true" />
        No cases yet
      </div>
    );
  }

  return (
    <Select value={selectedId} onValueChange={handleChange}>
      <SelectTrigger
        className={cn("w-full bg-white/5 sm:w-[280px]", className)}
        aria-label="Switch case"
      >
        <span className="flex min-w-0 items-center gap-2">
          <FolderKanban
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <SelectValue placeholder="Select a case…" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {cases.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex flex-col">
              <span className="font-medium">{c.case_number}</span>
              <span className="truncate text-xs text-muted-foreground">
                {c.title}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default CaseSelector;

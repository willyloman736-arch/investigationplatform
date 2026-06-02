// ─────────────────────────────────────────────────────────────────────────────
// Admin cases — create, assign, and manage every case.
//
// Server Component. Loads all cases (with their parties + escrow populated so the
// management table can render assignment state) and renders:
//   • CreateCaseDialog (createCase)
//   • CaseManagementTable (updateCaseStatus, assignParties)
//
// All mutations run through the matching server actions; this page only reads.
// ─────────────────────────────────────────────────────────────────────────────

import { FolderKanban } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { getAllCasesForAdmin, getCaseParties, getEscrow } from "@/lib/data";
import type { CaseWithRelations } from "@/lib/types";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { CaseManagementTable } from "@/components/admin/CaseManagementTable";
import { CreateCaseDialog } from "@/components/admin/CreateCaseDialog";

export const metadata = {
  title: `Cases · ${APP_NAME}`,
};

async function getCasesWithRelations(): Promise<CaseWithRelations[]> {
  const cases = await getAllCasesForAdmin();
  return Promise.all(
    cases.map(async (c) => ({
      ...c,
      parties: await getCaseParties(c.id),
      escrow: await getEscrow(c.id),
    }))
  );
}

export default async function AdminCasesPage() {
  const cases = await getCasesWithRelations();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          as="h1"
          eyebrow="Case management"
          title="Cases"
          subtitle="Create new escrow cases, assign Party A and Party B, and manage each case's lifecycle. Status changes are admin-only and recorded in the audit log."
        />
        <CreateCaseDialog />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderKanban className="h-4 w-4 text-primary" />
          <span>
            {cases.length} {cases.length === 1 ? "case" : "cases"} total
          </span>
        </div>
        <CaseManagementTable cases={cases} />
      </section>
    </div>
  );
}

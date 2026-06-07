import type { Metadata } from "next";

import ClientCasesPage from "@/app/dashboard/cases/page";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Recovery Case Dashboard · ${APP_NAME}`,
  description:
    "Open and manage recovery complaints before accessing the linked escrow workspace.",
};

export default ClientCasesPage;

import { NextResponse } from "next/server";

import {
  APP_NAME,
  APP_TAGLINE,
  CARD_PAYOUT_BRANDS_LABEL,
  PAYOUT_METHOD_LABELS,
  PROVIDER_DISCLAIMER,
  SUPPORTED_PAYOUT_METHODS_LABEL,
} from "@/lib/constants";
import { getCaseById, getReceiptById, getWithdrawalRequest } from "@/lib/data";
import { createReceiptPdf } from "@/lib/pdf";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { RecoveryReceipt } from "@/lib/types";

interface RouteContext {
  params: { receiptId: string };
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** "withdrawal_approval" → "Withdrawal Approval" */
function titleCaseKind(kind: string): string {
  return kind
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function previewReceiptFromId(receiptId: string): RecoveryReceipt | null {
  if (!receiptId.startsWith("preview-")) return null;
  try {
    const payload = receiptId.slice("preview-".length);
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Omit<RecoveryReceipt, "id">;
    return { id: receiptId, ...parsed };
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const receipt =
    (await getReceiptById(params.receiptId)) ??
    previewReceiptFromId(params.receiptId);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const [caseRow, withdrawal] = await Promise.all([
    getCaseById(receipt.case_id),
    getWithdrawalRequest(receipt.case_id),
  ]);

  const pdf = createReceiptPdf({
    brandName: APP_NAME,
    brandTagline: APP_TAGLINE,
    receiptNumber: receipt.receipt_number,
    title: receipt.title,
    kindLabel: titleCaseKind(receipt.kind),
    caseNumber: caseRow?.case_number ?? receipt.case_id,
    caseTitle: caseRow?.title ?? "Unknown case",
    recipientEmail: receipt.recipient_email,
    issued: formatDateTime(receipt.issued_at),
    amountLabel:
      receipt.amount !== null
        ? formatCurrency(receipt.amount, receipt.currency)
        : null,
    payoutMethod: withdrawal ? PAYOUT_METHOD_LABELS[withdrawal.method] : null,
    payoutDestination: withdrawal?.destination_label ?? null,
    supportedPayoutMethodsLabel: SUPPORTED_PAYOUT_METHODS_LABEL,
    cardPayoutBrandsLabel: CARD_PAYOUT_BRANDS_LABEL,
    notes: receipt.notes ?? "No notes recorded.",
    disclaimers: [
      "This receipt is a platform record. Actual fund movement must be confirmed by the secure server-side escrow or payment provider workflow.",
      PROVIDER_DISCLAIMER,
    ],
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFileName(
        receipt.receipt_number
      )}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

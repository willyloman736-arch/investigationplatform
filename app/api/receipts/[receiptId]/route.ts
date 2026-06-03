import { NextResponse } from "next/server";

import { APP_NAME } from "@/lib/constants";
import { getCaseById, getReceiptById } from "@/lib/data";
import { createSimplePdf } from "@/lib/pdf";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { RecoveryReceipt } from "@/lib/types";

interface RouteContext {
  params: { receiptId: string };
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
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

  const caseRow = await getCaseById(receipt.case_id);
  const amount =
    receipt.amount !== null
      ? formatCurrency(receipt.amount, receipt.currency)
      : "No amount recorded";

  const pdf = createSimplePdf({
    title: `${APP_NAME} Receipt`,
    lines: [
      `Receipt number: ${receipt.receipt_number}`,
      `Receipt title: ${receipt.title}`,
      `Case: ${caseRow?.case_number ?? receipt.case_id}`,
      `Case title: ${caseRow?.title ?? "Unknown case"}`,
      `Recipient: ${receipt.recipient_email}`,
      `Amount: ${amount}`,
      `Issued: ${formatDateTime(receipt.issued_at)}`,
      `Receipt type: ${receipt.kind.replace(/_/g, " ")}`,
      `Notes: ${receipt.notes ?? "No notes recorded."}`,
      "This receipt is a platform record. Actual fund movement must be confirmed by the secure server-side escrow or payment provider workflow.",
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

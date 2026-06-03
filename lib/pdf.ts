// ─────────────────────────────────────────────────────────────────────────────
// Zero-dependency PDF builder for branded, professional receipts.
//
// The previous version emitted a single Helvetica font in flat black text, which
// rendered receipts as a plain text dump. This builder adds the primitives needed
// for a polished, invoice-grade document — RGB fills & strokes, rectangles, rules,
// a simple vector emblem, two weights (Helvetica + Helvetica-Bold), and measured
// text with left/right/center alignment + word wrapping (via the Helvetica AFM
// width tables) so figures line up like a real invoice.
//
// Still single-page US Letter and dependency-free, matching the project's
// deliberate no-PDF-library approach.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_W = 612;
const PAGE_H = 792;

// Helvetica / Helvetica-Bold advance widths (per 1000 em) for ASCII 32..126.
// Source: the standard Adobe AFM metrics. Used for alignment + wrapping.
const W_HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const W_HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

function sanitizeText(value: string): string {
  return value
    .replace(/\r?\n/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function charWidth(ch: string, bold: boolean): number {
  const idx = ch.charCodeAt(0) - 32;
  const table = bold ? W_HELV_BOLD : W_HELV;
  if (idx < 0 || idx >= table.length) return bold ? 611 : 556;
  return table[idx];
}

/** Width of a string in points at a given size (excludes extra char spacing). */
function measureText(text: string, size: number, bold: boolean): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch, bold);
  return (width * size) / 1000;
}

/** Greedy word-wrap by measured width; hard-breaks tokens longer than maxWidth. */
function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  bold: boolean
): string[] {
  const words = sanitizeText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushWord = (word: string) => {
    // Hard-break a single token that cannot fit on one line.
    if (measureText(word, size, bold) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (measureText(chunk + ch, size, bold) > maxWidth && chunk) {
          if (current) {
            lines.push(current);
            current = "";
          }
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (current) {
        const joined = `${current} ${chunk}`;
        if (measureText(joined, size, bold) > maxWidth) {
          lines.push(current);
          current = chunk;
        } else {
          current = joined;
        }
      } else {
        current = chunk;
      }
      return;
    }
    const next = current ? `${current} ${word}` : word;
    if (measureText(next, size, bold) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  };

  for (const word of words) pushWord(word);
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function hexToRgbOps(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: string;
  align?: "left" | "right" | "center";
  charSpace?: number;
}

interface RectOptions {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
}

/** Minimal single-page content-stream canvas. Coordinates are PDF user space. */
class PdfCanvas {
  private ops: string[] = [];

  /** Convert a top-down y (0 = page top) to PDF user space (0 = page bottom). */
  fromTop(yTop: number): number {
    return PAGE_H - yTop;
  }

  rect(x: number, y: number, w: number, h: number, opts: RectOptions = {}): void {
    const { fill, stroke, lineWidth = 1 } = opts;
    this.ops.push("q");
    if (fill) this.ops.push(`${hexToRgbOps(fill)} rg`);
    if (stroke) {
      this.ops.push(`${hexToRgbOps(stroke)} RG`);
      this.ops.push(`${lineWidth} w`);
    }
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    if (fill && stroke) this.ops.push("B");
    else if (fill) this.ops.push("f");
    else this.ops.push("S");
    this.ops.push("Q");
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 1
  ): void {
    this.ops.push("q");
    this.ops.push(`${hexToRgbOps(color)} RG`);
    this.ops.push(`${width} w`);
    this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    this.ops.push("Q");
  }

  /** Draw a small shield emblem with an inset check mark (vector). */
  shield(cx: number, topY: number, w: number, h: number, fill: string, mark: string): void {
    const half = w / 2;
    const x0 = cx - half;
    const x1 = cx + half;
    this.ops.push("q");
    this.ops.push(`${hexToRgbOps(fill)} rg`);
    this.ops.push(`${x0.toFixed(2)} ${topY.toFixed(2)} m`);
    this.ops.push(`${x1.toFixed(2)} ${topY.toFixed(2)} l`);
    this.ops.push(`${x1.toFixed(2)} ${(topY - h * 0.42).toFixed(2)} l`);
    this.ops.push(
      `${x1.toFixed(2)} ${(topY - h * 0.78).toFixed(2)} ${cx.toFixed(2)} ${(topY - h).toFixed(2)} ${cx.toFixed(2)} ${(topY - h).toFixed(2)} c`
    );
    this.ops.push(
      `${cx.toFixed(2)} ${(topY - h).toFixed(2)} ${x0.toFixed(2)} ${(topY - h * 0.78).toFixed(2)} ${x0.toFixed(2)} ${(topY - h * 0.42).toFixed(2)} c`
    );
    this.ops.push("h");
    this.ops.push("f");
    this.ops.push("Q");
    // Check mark
    this.ops.push("q");
    this.ops.push(`${hexToRgbOps(mark)} RG`);
    this.ops.push("2.2 w 1 J 1 j");
    const yMid = topY - h * 0.52;
    this.ops.push(
      `${(cx - w * 0.22).toFixed(2)} ${yMid.toFixed(2)} m ${(cx - w * 0.02).toFixed(2)} ${(yMid - h * 0.2).toFixed(2)} l ${(cx + w * 0.26).toFixed(2)} ${(yMid + h * 0.18).toFixed(2)} l S`
    );
    this.ops.push("Q");
  }

  /** Draw text. Returns the rendered width in points. */
  text(text: string, x: number, y: number, opts: TextOptions = {}): number {
    const { size = 10, bold = false, color = "#0F172A", align = "left", charSpace = 0 } = opts;
    const clean = sanitizeText(text);
    const width =
      measureText(clean, size, bold) + (clean.length > 1 ? charSpace * (clean.length - 1) : 0);
    let tx = x;
    if (align === "right") tx = x - width;
    else if (align === "center") tx = x - width / 2;

    this.ops.push("BT");
    this.ops.push(`${hexToRgbOps(color)} rg`);
    if (charSpace) this.ops.push(`${charSpace.toFixed(2)} Tc`);
    this.ops.push(`${bold ? "/F2" : "/F1"} ${size} Tf`);
    this.ops.push(`${tx.toFixed(2)} ${y.toFixed(2)} Td`);
    this.ops.push(`(${escapePdfText(clean)}) Tj`);
    if (charSpace) this.ops.push("0 Tc");
    this.ops.push("ET");
    return width;
  }

  build(): Buffer {
    const stream = this.ops.join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((obj, index) => {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "utf8");
  }
}

export interface ReceiptPdfInput {
  brandName: string;
  brandTagline: string;
  receiptNumber: string;
  title: string;
  /** Human-readable receipt kind, e.g. "Withdrawal Approval". */
  kindLabel: string;
  caseNumber: string;
  caseTitle: string;
  recipientEmail: string;
  /** Pre-formatted issued timestamp. */
  issued: string;
  /** Pre-formatted amount, or null when no monetary value applies. */
  amountLabel: string | null;
  /** Real payout method label (e.g. "PayPal"), when a withdrawal exists. */
  payoutMethod?: string | null;
  /** Real payout destination label, when a withdrawal exists. */
  payoutDestination?: string | null;
  /** Always printed on receipts so clients see the supported withdrawal rails. */
  supportedPayoutMethodsLabel: string;
  /** Card brands shown for the Visa/Mastercard payout rail. */
  cardPayoutBrandsLabel: string;
  notes: string;
  /** Footer disclaimer lines (kept verbatim — honest, not embellished). */
  disclaimers: string[];
}

const COLORS = {
  navy: "#061826",
  blue: "#2563EB",
  ice: "#67E8F9",
  ink: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  line: "#E2E8F0",
  soft: "#EFF5FF",
  card: "#F8FAFC",
  white: "#FFFFFF",
};

const ML = 56; // left margin
const MR = 556; // right edge
const CW = MR - ML; // content width

/** Compose a branded, invoice-grade receipt PDF. */
export function createReceiptPdf(input: ReceiptPdfInput): Buffer {
  const p = new PdfCanvas();
  const top = (t: number) => p.fromTop(t);

  // ── Header band ─────────────────────────────────────────────────────────
  p.rect(0, top(96), PAGE_W, 96, { fill: COLORS.navy });
  p.rect(0, top(100), PAGE_W, 4, { fill: COLORS.ice });

  p.shield(ML + 13, top(26), 26, 30, COLORS.ice, COLORS.navy);
  p.text(input.brandName.toUpperCase(), ML + 40, top(44), {
    size: 14,
    bold: true,
    color: COLORS.white,
    charSpace: 0.4,
  });
  p.text(input.brandTagline, ML + 40, top(60), {
    size: 8.5,
    color: COLORS.ice,
    charSpace: 0.6,
  });

  p.text("OFFICIAL RECEIPT", MR, top(40), {
    size: 12.5,
    bold: true,
    color: COLORS.white,
    align: "right",
    charSpace: 0.8,
  });
  p.text(input.receiptNumber, MR, top(58), {
    size: 9.5,
    color: "#CBD5E1",
    align: "right",
  });

  // ── Title + kind pill ──────────────────────────────────────────────────
  const pillLabel = input.kindLabel.toUpperCase();
  const pillTextW = measureText(pillLabel, 8, true) + 0.6 * (pillLabel.length - 1);
  const pillW = pillTextW + 22;
  const pillH = 18;

  // Title wraps within the space left of the pill (max 2 lines; ellipsis if longer)
  // so it can never collide with the kind pill on the right.
  const titleMaxW = MR - pillW - 16 - ML;
  const titleLines = wrapText(input.title, titleMaxW, 17, true);
  const shownTitle = titleLines.slice(0, 2);
  if (titleLines.length > 2) {
    let last = shownTitle[1];
    while (last.length > 1 && measureText(`${last}...`, 17, true) > titleMaxW) {
      last = last.slice(0, -1);
    }
    shownTitle[1] = `${last.trim()}...`;
  }

  let y = 134;
  shownTitle.forEach((line, i) => {
    p.text(line, ML, top(y + i * 21), { size: 17, bold: true, color: COLORS.ink });
  });

  // Pill is pinned top-right, aligned with the first title line.
  p.rect(MR - pillW, top(132), pillW, pillH, { fill: COLORS.soft, stroke: "#BFDBFE", lineWidth: 0.8 });
  p.text(pillLabel, MR - pillW / 2, top(132) + 5.5, {
    size: 8,
    bold: true,
    color: COLORS.blue,
    align: "center",
    charSpace: 0.6,
  });

  y += (shownTitle.length - 1) * 21 + 20;
  p.text(`Issued ${input.issued}`, ML, top(y), { size: 9.5, color: COLORS.muted });
  y += 14;
  p.line(ML, top(y), MR, top(y), COLORS.line, 1);

  // ── Details card ─────────────────────────────────────────────────────────
  y += 22;
  p.text("RECEIPT DETAILS", ML, top(y), {
    size: 8.5,
    bold: true,
    color: COLORS.faint,
    charSpace: 1,
  });
  y += 10;

  const detailRows: Array<[string, string]> = [
    ["Case", input.caseNumber],
    ["Case title", input.caseTitle],
    ["Recipient", input.recipientEmail],
    ["Receipt type", input.kindLabel],
    ["Supported withdrawal methods", input.supportedPayoutMethodsLabel],
    ["Accepted card brands", input.cardPayoutBrandsLabel],
    ["Issued", input.issued],
  ];
  // Factual payout details — only when the case actually has a withdrawal request.
  if (input.payoutMethod) {
    detailRows.push(["Payout method", input.payoutMethod]);
    if (input.payoutDestination) {
      detailRows.push(["Destination", input.payoutDestination]);
    }
  }
  const rowH = 24;
  const cardTop = y;
  const cardH = detailRows.length * rowH + 14;
  p.rect(ML, top(cardTop + cardH), CW, cardH, {
    fill: COLORS.card,
    stroke: COLORS.line,
    lineWidth: 1,
  });
  detailRows.forEach(([label, value], i) => {
    const baseY = top(cardTop + 22 + i * rowH);
    p.text(label.toUpperCase(), ML + 16, baseY, {
      size: 8,
      bold: true,
      color: COLORS.faint,
      charSpace: 0.4,
    });
    // value, wrapped to a single trimmed line within the column
    const valueLines = wrapText(value, CW - 150 - 16, 10.5, false);
    p.text(valueLines[0], ML + 150, baseY, { size: 10.5, color: COLORS.ink });
    if (i < detailRows.length - 1) {
      p.line(ML + 16, top(cardTop + 14 + (i + 1) * rowH), MR - 16, top(cardTop + 14 + (i + 1) * rowH), COLORS.line, 0.6);
    }
  });

  // ── Payment summary ──────────────────────────────────────────────────────
  let cursor = cardTop + cardH + 30;
  p.text("PAYMENT SUMMARY", ML, top(cursor), {
    size: 8.5,
    bold: true,
    color: COLORS.faint,
    charSpace: 1,
  });
  cursor += 12;

  if (input.amountLabel) {
    // Header row
    p.rect(ML, top(cursor + 22), CW, 22, { fill: COLORS.soft });
    p.text("DESCRIPTION", ML + 12, top(cursor + 15), {
      size: 8,
      bold: true,
      color: COLORS.muted,
      charSpace: 0.6,
    });
    p.text("AMOUNT", MR - 12, top(cursor + 15), {
      size: 8,
      bold: true,
      color: COLORS.muted,
      align: "right",
      charSpace: 0.6,
    });
    cursor += 22;

    // Line item
    const itemLine = wrapText(input.title, CW - 24 - 120, 10.5, false)[0];
    p.text(itemLine, ML + 12, top(cursor + 17), { size: 10.5, color: COLORS.body });
    p.text(input.amountLabel, MR - 12, top(cursor + 17), {
      size: 10.5,
      color: COLORS.ink,
    });
    cursor += 26;
    p.line(ML, top(cursor), MR, top(cursor), COLORS.line, 0.8);
    cursor += 6;

    // Total box
    p.rect(ML, top(cursor + 30), CW, 30, { fill: "#0B2A4A" });
    p.text("TOTAL", ML + 14, top(cursor + 20), {
      size: 10,
      bold: true,
      color: COLORS.white,
      charSpace: 0.8,
    });
    p.text(input.amountLabel, MR - 14, top(cursor + 20), {
      size: 13,
      bold: true,
      color: COLORS.white,
      align: "right",
    });
    cursor += 30;
  } else {
    p.rect(ML, top(cursor + 26), CW, 26, {
      fill: COLORS.card,
      stroke: COLORS.line,
      lineWidth: 1,
    });
    p.text("No monetary amount is recorded on this receipt.", ML + 14, top(cursor + 17), {
      size: 10,
      color: COLORS.muted,
    });
    cursor += 26;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  cursor += 28;
  p.text("NOTES", ML, top(cursor), {
    size: 8.5,
    bold: true,
    color: COLORS.faint,
    charSpace: 1,
  });
  cursor += 8;
  const noteLines = wrapText(input.notes, CW - 28, 10, false).slice(0, 4);
  const noteCardH = noteLines.length * 14 + 16;
  p.rect(ML, top(cursor + noteCardH), CW, noteCardH, {
    fill: COLORS.card,
    stroke: COLORS.line,
    lineWidth: 1,
  });
  noteLines.forEach((ln, i) => {
    p.text(ln, ML + 14, top(cursor + 16 + i * 14), { size: 10, color: COLORS.body });
  });
  cursor += noteCardH;

  // ── Honest verification strip ──────────────────────────────────────────────
  cursor += 22;
  const stripH = 34;
  p.rect(ML, top(cursor + stripH), CW, stripH, { fill: COLORS.soft, stroke: "#BFDBFE", lineWidth: 0.8 });
  p.shield(ML + 22, top(cursor + 8), 18, 21, COLORS.blue, COLORS.white);
  p.text("Verified platform record", ML + 42, top(cursor + 14), {
    size: 10,
    bold: true,
    color: COLORS.ink,
  });
  p.text(
    `Issued by ${input.brandName} - reference ${input.receiptNumber}`,
    ML + 42,
    top(cursor + 26),
    { size: 8.5, color: COLORS.muted }
  );

  // ── Footer (anchored to the page bottom with a guaranteed safe margin) ──────
  // Pre-wrap every disclaimer line, then lay the block out upward from a fixed
  // bottom margin so it can never crowd or spill past the page edge regardless
  // of how many lines the disclaimers wrap to.
  const footLines = input.disclaimers.flatMap((d) => wrapText(d, CW, 7.6, false));
  const footStep = 11.5;
  const bottomMargin = 50;
  const firstFootFromTop = PAGE_H - bottomMargin - (footLines.length - 1) * footStep;
  const brandFromTop = firstFootFromTop - 16;
  const ruleFromTop = brandFromTop - 13;

  p.line(ML, top(ruleFromTop), MR, top(ruleFromTop), COLORS.line, 1);
  p.text(`${input.brandName} - ${input.brandTagline}`, ML, top(brandFromTop), {
    size: 8.5,
    bold: true,
    color: COLORS.muted,
  });
  footLines.forEach((line, i) => {
    p.text(line, ML, top(firstFootFromTop + i * footStep), {
      size: 7.6,
      color: COLORS.faint,
    });
  });

  return p.build();
}

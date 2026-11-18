import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PayslipData = {
  storeName: string;
  employee: { name: string; employeeNo: string; position: string | null; department: string | null; bankName: string | null; accountNumber: string | null };
  periodStart: Date;
  periodEnd: Date;
  payDate: Date | null;
  status: string;
  basic: number;
  allowances: number;
  pension: number;
  nhf: number;
  paye: number;
  otherDeductions: number;
  gross: number;
  deductions: number;
  net: number;
};

type ItemLike = { basic: unknown; allowances: unknown; deductions: unknown; gross: unknown; net: unknown; pension?: unknown; nhf?: unknown; paye?: unknown; note?: string | null };
const n = (v: unknown) => Number(v ?? 0);

/**
 * Splits an item's deductions into pension / NHF / PAYE. Runs created before those columns existed
 * only have the figures inside the note ("Pension 1 | NHF 2 | PAYE 3"), so fall back to reading it.
 */
export function deductionBreakdown(item: ItemLike) {
  let pension = n(item.pension), nhf = n(item.nhf), paye = n(item.paye);
  const total = n(item.deductions);
  if (pension + nhf + paye === 0 && total > 0 && item.note) {
    const m = item.note.match(/Pension\s+([\d.]+)\s*\|\s*NHF\s+([\d.]+)\s*\|\s*PAYE\s+([\d.]+)/i);
    if (m) { pension = +m[1]; nhf = +m[2]; paye = +m[3]; }
  }
  const other = Math.max(0, Math.round((total - pension - nhf - paye) * 100) / 100);
  return { pension, nhf, paye, other };
}

export const naira = (v: number) => `NGN ${v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export function payslipFileName(p: Pick<PayslipData, "employee" | "periodEnd">) {
  const safe = p.employee.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return `Payslip_${safe}_${p.periodEnd.toISOString().slice(0, 7)}.pdf`;
}

export async function renderPayslipPdf(p: PayslipData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12), muted = rgb(0.4, 0.4, 0.45), line = rgb(0.85, 0.85, 0.88);
  const L = 48, R = 547;
  let y = 790;

  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const right = (s: string, x: number, size = 10, f = font) => page.drawText(s, { x: x - f.widthOfTextAtSize(s, size), y, size, font: f, color: ink });
  const rule = () => { page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.6, color: line }); };

  text(p.storeName.slice(0, 48), L, 18, bold); y -= 20;
  text("PAYSLIP", L, 10, bold, muted);
  right(`${fmtDate(p.periodStart)} - ${fmtDate(p.periodEnd)}`, R, 10, bold); y -= 10;
  if (p.status !== "PAID" && p.status !== "APPROVED") { text(`Status: ${p.status} (not final)`, L, 9, font, rgb(0.75, 0.2, 0.2)); }
  y -= 14; rule(); y -= 22;

  const info: [string, string][] = [
    ["Employee", p.employee.name], ["Employee no.", p.employee.employeeNo],
    ["Position", p.employee.position || "-"], ["Department", p.employee.department || "-"],
    ["Pay date", p.payDate ? fmtDate(p.payDate) : "Not yet paid"],
    ["Bank", p.employee.bankName ? `${p.employee.bankName}${p.employee.accountNumber ? ` ****${p.employee.accountNumber.slice(-4)}` : ""}` : "-"],
  ];
  for (let i = 0; i < info.length; i += 2) {
    text(info[i][0], L, 8, font, muted);
    page.drawText(info[i + 1][0], { x: 300, y, size: 8, font, color: muted });
    y -= 13;
    text(info[i][1], L, 10, bold);
    page.drawText(info[i + 1][1], { x: 300, y, size: 10, font: bold, color: ink });
    y -= 20;
  }
  y -= 6; rule(); y -= 22;

  const section = (title: string, rows: [string, number][], totalLabel: string, total: number) => {
    text(title, L, 11, bold); y -= 18;
    for (const [label, amount] of rows) { text(label, L, 10); right(naira(amount), R); y -= 15; }
    rule(); y -= 14;
    text(totalLabel, L, 10, bold); right(naira(total), R, 10, bold); y -= 26;
  };
  section("Earnings", [["Basic salary", p.basic], ["Allowances (housing, transport, other)", p.allowances]], "Gross pay", p.gross);
  const deductionRows: [string, number][] = [["Employee pension (8%)", p.pension], ["National Housing Fund", p.nhf], ["PAYE income tax", p.paye]];
  if (p.otherDeductions > 0) deductionRows.push(["Other deductions", p.otherDeductions]);
  section("Deductions", deductionRows, "Total deductions", p.deductions);

  page.drawRectangle({ x: L, y: y - 14, width: R - L, height: 36, color: rgb(0.95, 0.96, 0.98) });
  text("NET PAY", L + 12, 12, bold); right(naira(p.net), R - 12, 14, bold);
  y -= 50;
  text("Computer-generated payslip. Statutory figures are estimates for payroll preparation; confirm with your accountant.", L, 7.5, font, muted);

  return pdf.save();
}

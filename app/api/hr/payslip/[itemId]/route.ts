import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreAccessRole, hasStorePermission } from "@/lib/access/store-access";
import { findMyEmployee } from "@/lib/hr/self";
import { buildPayslipData } from "@/lib/hr/payslip-data";
import { payslipFileName, renderPayslipPdf } from "@/lib/hr/payslip";

/** GET /api/hr/payslip/<payroll item id> -> the payslip as a PDF (?inline=1 to view instead of download). */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to view payslips." }, { status: 401 });

  const item = await prisma.hrPayrollItem.findUnique({ where: { id: itemId }, include: { payrollRun: { include: { store: { include: { business: true } } } } } });
  if (!item) return NextResponse.json({ error: "Payslip not found." }, { status: 404 });
  const store = item.payrollRun.store;

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  let allowed = false;
  if (role === "OWNER" || role === "PLATFORM_STAFF") allowed = true;
  else if (role === "MANAGER" || role === "STAFF") {
    const m = await prisma.storeStaff.findFirst({ where: { storeId: store.id, userId: session.user.id, status: "ACTIVE" }, select: { permissions: true } });
    allowed = hasStorePermission(role, m?.permissions, "hr") || hasStorePermission(role, m?.permissions, "plugin:hr-payroll");
  }
  // A worker can always open their own payslip, but only once the run is approved or paid.
  if (!allowed && role !== null) {
    const me = await findMyEmployee(store.id, { id: session.user.id, email: session.user.email });
    allowed = !!me && me.id === item.employeeId && ["APPROVED", "PAID"].includes(item.payrollRun.status);
  }
  if (!allowed) return NextResponse.json({ error: "You can't view this payslip." }, { status: 403 });

  const data = await buildPayslipData(itemId);
  if (!data) return NextResponse.json({ error: "Payslip not found." }, { status: 404 });
  const bytes = await renderPayslipPdf(data);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${payslipFileName(data)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

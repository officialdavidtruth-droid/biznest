// Route: /store/[slug]/table/[token] — the link printed in each table's QR code.
// Remembers which table the guest is at, then sends them to the store's menu.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeBasePath } from "@/lib/store-pwa";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const table = await prisma.fnbTable.findFirst({ where: { token, active: true, store: { slug } }, select: { name: true } });
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(`${origin}${storeBasePath(req.headers.get("host"), slug) || "/"}`);
  if (table) {
    res.cookies.set(`bn_table_${slug}`, token, { path: "/", maxAge: 60 * 60 * 6, httpOnly: true, sameSite: "lax", secure: true });
  }
  return res;
}

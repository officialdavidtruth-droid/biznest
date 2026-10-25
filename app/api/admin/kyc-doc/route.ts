import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import { parseKycUrl, signedKycDownloadUrl } from "@/lib/kyc-storage";
import { withObservability } from "@/lib/observability/api-wrapper";

/**
 * Admin-only viewer for private KYC documents.
 *
 *   GET /api/admin/kyc-doc?businessId=...&doc=cert|id|selfie
 *   GET /api/admin/kyc-doc?businessId=...&doc=guarantor&guarantorId=...
 *
 * The browser never receives a Cloudinary link: the document URL is looked up
 * from the DB (the request can't point us at an arbitrary file), fetched
 * server-side with a 2-minute signed link, and streamed back inline with
 * no-store caching. Every view is written to the audit log.
 */
export const GET = withObservability("admin-kyc-doc", async (req: Request) => {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const doc = searchParams.get("doc");
  if (!businessId || !doc) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      registrationCertUrl: true,
      governmentIdUrl: true,
      selfieUrl: true,
      guarantors: { select: { id: true, governmentIdUrl: true } },
    },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let url: string | null | undefined;
  if (doc === "cert") url = business.registrationCertUrl;
  else if (doc === "id") url = business.governmentIdUrl;
  else if (doc === "selfie") url = business.selfieUrl;
  else if (doc === "guarantor") {
    url = business.guarantors.find((g) => g.id === searchParams.get("guarantorId"))?.governmentIdUrl;
  }
  if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.auditLog.create({
    data: {
      userId: null,
      action: "KYC_DOCUMENT_VIEWED",
      entity: "Business",
      entityId: businessId,
      metadata: { doc, guarantorId: searchParams.get("guarantorId") },
    },
  });

  const parsed = parseKycUrl(url);
  // Legacy documents uploaded before private storage were public URLs.
  // Still viewable here so review isn't blocked, but they should be moved
  // with scripts/migrate-kyc-to-private.ts.
  if (!parsed) {
    if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) {
      return NextResponse.json({ error: "Unsupported document location" }, { status: 422 });
    }
    return NextResponse.redirect(url);
  }

  const upstream = await fetch(signedKycDownloadUrl(parsed), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Document could not be retrieved" }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { withObservability } from "@/lib/observability/api-wrapper";
import { isPlatformStaff } from "@/lib/admin-guard";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { OFFICIAL_SLUG, shortPersonName } from "@/lib/browse";

/** Who can be tagged: any visible business, or (never for the official account) the posting store's own customers. */
export const GET = withObservability("browse-tag-search", async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
  if (!slug) return NextResponse.json({ results: [] });

  let storeId: string;
  const official = slug === OFFICIAL_SLUG;
  if (official) {
    if (!(await isPlatformStaff())) return NextResponse.json({ error: "Admin PIN session expired." }, { status: 401 });
    const s = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!s) return NextResponse.json({ results: [] });
    storeId = s.id;
  } else {
    const a = await assertStorePermission(slug, "marketing");
    if (!a.success) return NextResponse.json({ error: a.error }, { status: 403 });
    storeId = a.store.id;
  }
  if (q.length < 2) return NextResponse.json({ results: [] });

  const rate = await checkRateLimit(`browse-tag-search:${storeId}`, 60, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many searches. Wait a moment." }, { status: 429 });

  const [stores, users] = await Promise.all([
    prisma.store.findMany({
      where: { id: { not: storeId }, slug: { not: OFFICIAL_SLUG }, status: "ACTIVE", name: { contains: q, mode: "insensitive" }, business: { is: { searchVisible: true } } },
      select: { id: true, name: true, slug: true, logoUrl: true }, take: 6,
    }),
    official ? [] : prisma.user.findMany({ where: { customerScopeStoreId: storeId, name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
  ]);
  return NextResponse.json({
    results: [
      ...stores.map((s: { id: string; name: string; slug: string; logoUrl: string | null }) => ({ kind: "store", id: s.id, name: s.name, sub: "Business", logoUrl: s.logoUrl })),
      ...users.map((u: { id: string; name: string | null }) => ({ kind: "user", id: u.id, name: shortPersonName(u.name), sub: "Customer", logoUrl: null })),
    ],
  });
});

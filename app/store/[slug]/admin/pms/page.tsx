import { notFound } from "next/navigation";
import { getPmsData, getPmsAccessStatus } from "@/lib/actions/pms";
import { prisma } from "@/lib/prisma";
import { PmsWorkspace } from "@/components/dashboard/pms-workspace";

export default async function PmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The Business Mogul / plan gate for this route already lives in
  // app/store/[slug]/admin/layout.tsx (redirect to
  // /${slug}/admin/subscription?pms=upgrade), which runs before this page
  // and outside the /admin loading.tsx Suspense boundary, so it always
  // takes effect on both a sidebar click and a hard refresh.
  //
  // This page used to run that exact same subscription check again and
  // redirect a second time on failure. Redundant on its own, but also
  // buggy: because this page renders inside that Suspense boundary,
  // redirect() thrown from here doesn't reliably propagate on a
  // client-side nav (a known Next.js App Router limitation) — clicking
  // "BizNest PMS" would just leave the old page on screen, and only a
  // full refresh (a fresh document request, not a streamed RSC nav)
  // actually followed the redirect. The two checks could also disagree
  // for PLATFORM_STAFF, who the layout lets through but this one didn't.
  //
  // All that's left to check here is access.allowed for a reason the
  // layout doesn't already cover — wrong business category — which 404s
  // rather than redirects, so it isn't subject to the same bug.
  const access = await getPmsAccessStatus(slug);
  if (!access.allowed) notFound();
  const [data, store] = await Promise.all([
    getPmsData(slug),
    prisma.store.findUnique({ where: { slug }, select: { name: true } }),
  ]);
  if (!data || !store) notFound();
  return <PmsWorkspace slug={slug} storeName={store.name} rooms={data.rooms} guests={data.guests} reservations={data.reservations} />;
}

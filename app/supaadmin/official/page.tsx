import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadVendorBrowse, loadVendorStories } from "@/lib/browse-data";
import { BROWSE_DAILY_POST_LIMIT, OFFICIAL_SLUG, storeBrowsePath } from "@/lib/browse";
import { BrowseWorkspace } from "@/components/dashboard/browse-workspace";
import { OfficialProfileForm, SetupOfficial } from "@/components/dashboard/official-profile-form";

export const dynamic = "force-dynamic";

export default async function OfficialAccountPage() {
  const store = await prisma.store.findUnique({
    where: { slug: OFFICIAL_SLUG },
    select: { id: true, name: true, logoUrl: true, followerCount: true, business: { select: { description: true } } },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">BizNest official account</h1>
        <p className="mt-1 text-sm text-muted-foreground">BizNest&apos;s own profile on Browse. It carries the blue verified check, people can follow it, and everything you post here shows in the public feed and story row.</p>
      </div>
      {!store ? <SetupOfficial /> : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-background p-4 text-sm">
            <span><b>{store.followerCount.toLocaleString("en-NG")}</b> follower{store.followerCount === 1 ? "" : "s"}</span>
            <Link className="underline" href={storeBrowsePath(OFFICIAL_SLUG)} target="_blank">View public profile</Link>
          </div>
          <OfficialProfileForm initial={{ name: store.name, bio: store.business?.description ?? "", logoUrl: store.logoUrl }} />
          <BrowseWorkspace slug={OFFICIAL_SLUG} data={await loadVendorBrowse(store.id)} stories={await loadVendorStories(store.id)} products={[]} dailyLimit={BROWSE_DAILY_POST_LIMIT} />
        </>
      )}
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { ctr, spentNaira } from "@/lib/ads";
import { bestPostingHour } from "@/lib/browse";

export type InsightRange = 7 | 30 | 90;
export const INSIGHT_RANGES: InsightRange[] = [7, 30, 90];

/** The Lagos calendar day (UTC+1, no daylight saving) `daysBack` days ago, as a Date at midnight UTC. */
function lagosDay(daysBack: number): Date {
  const d = new Date(Date.now() + 3_600_000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d;
}

export type PostInsight = { id: string; caption: string; createdAt: string; impressions: number; shares: number; likes: number; comments: number; saves: number; shopTaps: number };

export type BrowseInsights = {
  days: InsightRange;
  profileViews: number;
  impressions: number;
  shares: number;
  followers: number;
  newFollowers: number;
  likes: number;
  comments: number;
  storyViews: number;
  saves: number;
  shopTaps: number;
  /** Lagos hour (0-23) when posts earned the most engagement per post, or null with too few posts. */
  bestHour: number | null;
  posts: PostInsight[];
  ads: { campaigns: number; active: number; impressions: number; clicks: number; ctr: number; spent: number };
};

/** Everything the Browse Insights page shows for one store over the last `days` days. */
export async function loadBrowseInsights(storeId: string, days: InsightRange): Promise<BrowseInsights> {
  const since = lagosDay(days - 1);
  const sinceInstant = new Date(Date.now() - days * 86_400_000);

  const [stats, perPost, followers, newFollowers, storyViews, posts, campaigns] = await Promise.all([
    prisma.browseStat.groupBy({ by: ["kind"], where: { storeId, day: { gte: since }, postId: "" }, _sum: { count: true } }),
    prisma.browseStat.groupBy({ by: ["postId", "kind"], where: { storeId, day: { gte: since }, postId: { not: "" } }, _sum: { count: true } }),
    prisma.browseFollow.count({ where: { storeId } }),
    prisma.browseFollow.count({ where: { storeId, createdAt: { gte: sinceInstant } } }),
    prisma.browseStoryView.count({ where: { story: { storeId }, createdAt: { gte: sinceInstant } } }),
    prisma.browsePost.findMany({ where: { storeId, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, caption: true, createdAt: true, likeCount: true, commentCount: true, saveCount: true, shopTapCount: true } }),
    prisma.adCampaign.findMany({ where: { storeId, status: { not: "REMOVED" } }, select: { status: true, impressions: true, clicks: true, rateNaira: true, budget: true } }),
  ]);

  const storeLevel = (kind: string) => stats.find((s) => s.kind === kind)?._sum.count ?? 0;
  const postLevel = (id: string, kind: string) => perPost.find((s) => s.postId === id && s.kind === kind)?._sum.count ?? 0;
  const postImpressions = perPost.filter((s) => s.kind === "POST_IMPRESSION").reduce((a, s) => a + (s._sum.count ?? 0), 0);
  const postShares = perPost.filter((s) => s.kind === "SHARE").reduce((a, s) => a + (s._sum.count ?? 0), 0);

  const allPosts = await prisma.browsePost.aggregate({ where: { storeId, status: "PUBLISHED" }, _sum: { likeCount: true, commentCount: true } });

  const bestHour = bestPostingHour(posts.map((p) => ({ createdAt: p.createdAt, score: p.likeCount + 2 * p.commentCount + 3 * p.saveCount + 4 * p.shopTapCount })));
  const adImpressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const adClicks = campaigns.reduce((a, c) => a + c.clicks, 0);

  return {
    days,
    profileViews: storeLevel("PROFILE_VIEW"),
    impressions: postImpressions,
    // Shares of the profile plus shares of individual posts.
    shares: storeLevel("SHARE") + postShares,
    followers,
    newFollowers,
    likes: allPosts._sum.likeCount ?? 0,
    comments: allPosts._sum.commentCount ?? 0,
    storyViews,
    saves: storeLevel("SAVE") + perPost.filter((s) => s.kind === "SAVE").reduce((a, s) => a + (s._sum.count ?? 0), 0),
    shopTaps: perPost.filter((s) => s.kind === "SHOP_TAP").reduce((a, s) => a + (s._sum.count ?? 0), 0),
    bestHour,
    posts: posts.slice(0, 15).map((p) => ({
      id: p.id,
      caption: p.caption,
      createdAt: p.createdAt.toISOString(),
      impressions: postLevel(p.id, "POST_IMPRESSION"),
      shares: postLevel(p.id, "SHARE"),
      likes: p.likeCount,
      comments: p.commentCount,
      saves: postLevel(p.id, "SAVE"),
      shopTaps: postLevel(p.id, "SHOP_TAP"),
    })),
    ads: {
      campaigns: campaigns.length,
      active: campaigns.filter((c) => c.status === "ACTIVE").length,
      impressions: adImpressions,
      clicks: adClicks,
      ctr: ctr(adClicks, adImpressions),
      spent: campaigns.reduce((a, c) => a + spentNaira(c.impressions, Number(c.rateNaira), Number(c.budget)), 0),
    },
  };
}

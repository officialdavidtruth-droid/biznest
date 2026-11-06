import { ImageResponse } from "next/og";
import { loadStoreProfile } from "@/lib/browse-data";
import { compactCount, isOfficialSlug } from "@/lib/browse";

export const alt = "A business on BizNest";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

/** Preview card for a business profile: name, bio and follower count. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = /^[a-z0-9][a-z0-9-]{0,62}$/.test(slug) ? await loadStoreProfile(slug) : null;
  const name = p?.name ?? "BizNest";
  const bio = (p?.bio || (p?.city ? `A business in ${p.city} on BizNest` : "Businesses posting on BizNest")).slice(0, 130);
  const official = isOfficialSlug(p?.slug);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#14301A", color: "#FBF6E9", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", width: 150, height: 150, borderRadius: 75, background: "#F5B82E", color: "#14301A", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 800 }}>{name.slice(0, 1).toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
            {official && <div style={{ display: "flex", fontSize: 30, color: "#FFE08A", border: "3px solid #F5B82E", borderRadius: 999, padding: "4px 20px", alignSelf: "flex-start" }}>Official BizNest account</div>}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 44, lineHeight: 1.25, color: "#FBF6E9" }}>{bio}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 32, color: "#F5B82E" }}>
          <span>{p ? `${compactCount(p.followerCount)} follower${p.followerCount === 1 ? "" : "s"}` : ""}</span>
          <span>biznest.space/browse</span>
        </div>
      </div>
    ),
    size,
  );
}

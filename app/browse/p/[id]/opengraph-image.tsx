import { ImageResponse } from "next/og";
import { loadBrowsePost } from "@/lib/browse-data";
import { isOfficialSlug, previewPrice } from "@/lib/browse";

export const alt = "A post on BizNest";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

/** Preview card for posts that have no photo of their own (text updates): shop name, caption and price on BizNest green. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = /^[A-Za-z0-9_-]{10,40}$/.test(id) ? await loadBrowsePost(id) : null;
  const name = post?.store.name ?? "BizNest";
  const price = post?.product ? previewPrice(post.product.price, post.product.currency) : null;
  const text = (post?.product?.name ?? post?.caption ?? "See what businesses are posting on BizNest").slice(0, 150);
  const official = isOfficialSlug(post?.store.slug);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#14301A", color: "#FBF6E9", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 72, height: 72, borderRadius: 36, background: "#F5B82E", color: "#14301A", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{name.slice(0, 1).toUpperCase()}</div>
          <span>{name}</span>
          {official && <span style={{ display: "flex", fontSize: 26, color: "#FFE08A", border: "3px solid #F5B82E", borderRadius: 999, padding: "4px 18px" }}>Official</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>{text}</div>
          {price && <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: "#14301A", background: "#F5B82E", padding: "6px 28px", borderRadius: 16, alignSelf: "flex-start" }}>{price}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#F5B82E" }}>biznest.space/browse</div>
      </div>
    ),
    size,
  );
}

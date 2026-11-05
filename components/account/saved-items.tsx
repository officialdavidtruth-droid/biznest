"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleStoreWishlist } from "@/lib/actions/account";
import { formatMoney } from "@/lib/utils/format-money";

export type SavedItem = { id: string; kind: "product" | "service"; targetId: string; name: string; price: number | null; currency: string; image: string | null };

/** The customer's saved products and services, for stores that aren't hotels. */
export function SavedItems({ slug, items }: { slug: string; items: SavedItem[] }) {
  const [list, setList] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = (item: SavedItem) => start(async () => {
    setError(null);
    const r = await toggleStoreWishlist(slug, item.kind === "product" ? { productId: item.targetId } : { serviceId: item.targetId });
    if (r.success) setList((cur) => cur.filter((x) => x.id !== item.id));
    else setError(r.error);
  });

  if (!list.length) return <div className="veloura-empty">You haven&apos;t saved anything yet.<div style={{ marginTop: 10 }}><Link href={`/store/${slug}`}>Browse the store →</Link></div></div>;
  return (
    <>
      {error && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{error}</p>}
      <div className="veloura-room-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
        {list.map((item) => (
          <article className="veloura-room-card" key={item.id} style={{ background: "#fff" }}>
            {item.image ? <img src={item.image} alt="" style={{ height: 170 }} /> : <div style={{ height: 170, background: "#f3f0ea" }} />}
            <div style={{ padding: 14 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>{item.name}</h3>
              {item.price != null && <p style={{ margin: "6px 0 12px" }}><strong>{formatMoney(item.price, item.currency)}</strong></p>}
              <div className="veloura-room-actions">
                <Link href={`/store/${slug}/${item.kind}/${item.targetId}`}>View</Link>
                <button type="button" disabled={pending} onClick={() => remove(item)} style={{ fontSize: 8, border: "1px solid #d6cbb9", padding: 7, color: "#b42318", background: "none", cursor: "pointer" }}>Remove</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

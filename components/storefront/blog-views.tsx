"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Clock, Facebook, Link2, MessageCircle, Rss, Search, Twitter } from "lucide-react";
import { cssUrl, fontStack } from "@/lib/builder-safe";
import type { BuilderConfig } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { BuilderFooter, BuilderHeader } from "@/components/storefront/builder-renderer";
import type { SubpageStore } from "@/components/storefront/builder-subpages";
import type { BlogCardView } from "@/lib/blog-public";

type Design = BuilderConfig["design"];

function useTokens(designIn: Design) {
  const d: Design = { ...designIn, font: fontStack(designIn.font), headingFont: fontStack(designIn.headingFont) };
  const line = `${d.text}1f`;
  const width = d.containerWidth === "compact" ? 960 : d.containerWidth === "wide" ? 1320 : 1160;
  const card: React.CSSProperties = { background: d.surface, border: `1px solid ${line}`, borderRadius: d.radius, overflow: "hidden" };
  const chip = (active: boolean): React.CSSProperties => ({ display: "inline-block", padding: "7px 14px", fontSize: 13, fontWeight: 650, borderRadius: 999, border: `1px solid ${active ? d.primary : line}`, background: active ? d.primary : "transparent", color: active ? "#fff" : d.text });
  return { d, line, width, card, chip };
}

function Shell({ store, design, children, title, subtitle, crumbs }: { store: SubpageStore; design: Design; children: ReactNode; title?: string; subtitle?: string; crumbs?: { label: string; href?: string }[] }) {
  const { d, line, width } = useTokens(design);
  const experience = getBusinessExperience(store.business.category, { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices }, store.business.businessSubcategory);
  const base = `/store/${store.slug}`;
  const isService = experience.mode === "service";
  const storeLinks = [
    { label: "Home", href: base },
    { label: isService ? "Services" : "Shop", href: `${base}/catalog` },
    { label: "Blog", href: `${base}/blog` },
    { label: "About", href: `${base}/about` },
    { label: "Contact", href: `${base}/contact` },
  ];
  return (
    <main style={{ background: d.background, color: d.text, fontFamily: d.font, minHeight: "100vh" }}>
      <style>{`a{text-decoration:none;color:inherit}.bn-wrap{width:min(${width}px,calc(100% - 32px));margin:0 auto}.bn-grid{display:grid;gap:22px}.bn-blog-cols{grid-template-columns:repeat(3,1fr)}.bn-post-img{transition:transform .35s}.bn-post-card:hover .bn-post-img{transform:scale(1.04)}@media(max-width:900px){.bn-blog-cols{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:720px){.bn-nav-links{display:none!important}.bn-grid,.bn-blog-cols{grid-template-columns:1fr!important}.bn-feature{grid-template-columns:1fr!important}}`}</style>
      <BuilderHeader store={store} d={d} experience={experience} visible={[]} />
      {title && (
        <section style={{ background: d.surface, borderBottom: `1px solid ${line}` }}>
          <div className="bn-wrap" style={{ padding: "44px 0 34px" }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: d.muted, marginBottom: 14 }}>
              {(crumbs ?? [{ label: "Home", href: base }, { label: title }]).map((c, i, a) => (
                <span key={i}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span style={{ color: d.text }}>{c.label}</span>}{i < a.length - 1 && " / "}</span>
              ))}
            </nav>
            <h1 style={{ fontFamily: d.headingFont, fontSize: 40, lineHeight: 1.1, margin: 0 }}>{title}</h1>
            {subtitle && <p style={{ color: d.muted, margin: "10px 0 0", maxWidth: 640 }}>{subtitle}</p>}
          </div>
        </section>
      )}
      {children}
      <BuilderFooter store={store} d={d} visible={[]} storeLinks={storeLinks} />
    </main>
  );
}

function PostCard({ post, base, design, large }: { post: BlogCardView; base: string; design: Design; large?: boolean }) {
  const { d, line, card } = useTokens(design);
  const href = `${base}/blog/${post.slug}`;
  const image = post.image && (
    <div style={{ overflow: "hidden", aspectRatio: large ? "16/10" : "16/10", background: `${d.text}0d` }}>
      <div className="bn-post-img" role="img" aria-label={post.imageAlt} style={{ width: "100%", height: "100%", background: `url(${cssUrl(post.image)}) center/cover` }} />
    </div>
  );
  return (
    <article className="bn-post-card" style={{ ...card, display: large ? "grid" : "block", gridTemplateColumns: large && post.image ? "1.2fr 1fr" : undefined }}>
      {image && <Link href={href} tabIndex={-1} aria-hidden>{image}</Link>}
      <div style={{ padding: large ? 32 : 22, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {post.category && <Link href={`${base}/blog?category=${post.category.slug}`} style={{ color: d.accent, fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>{post.category.name}</Link>}
        <h2 style={{ fontFamily: d.headingFont, fontSize: large ? 30 : 21, lineHeight: 1.2, margin: "8px 0 0" }}><Link href={href}>{post.title}</Link></h2>
        <p style={{ color: d.muted, lineHeight: 1.7, fontSize: 15, margin: "10px 0 0" }}>{post.excerpt}</p>
        <div style={{ color: d.muted, fontSize: 13, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${line}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span>{post.date}</span><span aria-hidden>·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={13} />{post.minutes} min read</span>
        </div>
      </div>
    </article>
  );
}

export type BlogIndexProps = {
  store: SubpageStore; design: Design; featured: BlogCardView | null; posts: BlogCardView[]; page: number; totalPages: number; total: number;
  categories: { name: string; slug: string; count: number }[]; tags: string[]; activeCategory: { name: string; slug: string } | null; activeTag: string | null; query: string;
};

export function BlogIndexView(p: BlogIndexProps) {
  const { d, line, chip } = useTokens(p.design);
  const base = `/store/${p.store.slug}`;
  const qs = (over: Record<string, string | number | null>) => {
    const cur: Record<string, string | number | null> = { category: p.activeCategory?.slug ?? null, tag: p.activeTag, q: p.query || null, page: p.page > 1 ? p.page : null };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v !== null && v !== "" && v !== undefined) u.set(k, String(v));
    const s = u.toString();
    return `${base}/blog${s ? `?${s}` : ""}`;
  };
  const filtered = !!(p.activeCategory || p.activeTag || p.query);
  const title = p.activeCategory ? p.activeCategory.name : p.activeTag ? `#${p.activeTag}` : "Blog";
  const subtitle = p.query ? `Results for “${p.query}”` : p.activeCategory || p.activeTag ? `${p.total} ${p.total === 1 ? "post" : "posts"}` : `News, guides and stories from ${p.store.name}.`;
  return (
    <Shell store={p.store} design={p.design} title={title} subtitle={subtitle} crumbs={filtered ? [{ label: "Home", href: base }, { label: "Blog", href: `${base}/blog` }, { label: title }] : undefined}>
      <div className="bn-wrap" style={{ padding: "36px 0 8px" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`${base}/blog`} style={chip(!p.activeCategory && !p.activeTag && !p.query)}>All</Link>
            {p.categories.map((c) => <Link key={c.slug} href={`${base}/blog?category=${c.slug}`} style={chip(p.activeCategory?.slug === c.slug)}>{c.name} · {c.count}</Link>)}
          </div>
          <form action={`${base}/blog`} method="get" role="search" style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${line}`, borderRadius: 999, padding: "6px 14px", background: d.surface }}>
            <Search size={15} color={d.muted} />
            <input name="q" defaultValue={p.query} placeholder="Search posts" aria-label="Search posts" maxLength={80} style={{ border: 0, outline: 0, background: "transparent", color: d.text, fontSize: 14, width: 150 }} />
          </form>
        </div>

        {p.total === 0 ? (
          <div style={{ background: d.surface, border: `1px solid ${line}`, borderRadius: d.radius, padding: 48, textAlign: "center" }}>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 22, margin: 0 }}>{filtered ? "No posts found" : "No posts yet"}</h2>
            <p style={{ color: d.muted, margin: "8px 0 0" }}>{filtered ? "Try another category or search." : "Check back soon."}</p>
            {filtered && <Link href={`${base}/blog`} style={{ display: "inline-block", marginTop: 18, color: d.accent, fontWeight: 700 }}>View all posts</Link>}
          </div>
        ) : (
          <>
            {p.featured && <div style={{ marginBottom: 24 }}><PostCard post={p.featured} base={base} design={p.design} large /></div>}
            <div className="bn-grid bn-blog-cols">{p.posts.map((post) => <PostCard key={post.id} post={post} base={base} design={p.design} />)}</div>
            {p.totalPages > 1 && (
              <nav aria-label="Pagination" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, margin: "36px 0 0", fontSize: 14 }}>
                {p.page > 1 ? <Link href={qs({ page: p.page - 1 > 1 ? p.page - 1 : null })} style={chip(false)}>← Newer</Link> : <span />}
                <span style={{ color: d.muted }}>Page {p.page} of {p.totalPages}</span>
                {p.page < p.totalPages ? <Link href={qs({ page: p.page + 1 })} style={chip(false)}>Older →</Link> : <span />}
              </nav>
            )}
          </>
        )}

        {(
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${line}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {p.tags.map((t) => <Link key={t} href={`${base}/blog?tag=${encodeURIComponent(t)}`} style={{ ...chip(p.activeTag === t), fontSize: 12, padding: "5px 11px" }}>#{t}</Link>)}
            </div>
            <a href={`${base}/blog/rss.xml`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: d.muted, fontSize: 13 }}><Rss size={14} />RSS feed</a>
          </div>
        )}
      </div>
      <div style={{ height: 48 }} />
    </Shell>
  );
}

export type BlogPostViewProps = {
  store: SubpageStore; design: Design; post: BlogCardView & { updatedLabel: string }; url: string; children: ReactNode;
  related: BlogCardView[]; newer: { title: string; slug: string } | null; older: { title: string; slug: string } | null;
  toc: { id: string; text: string; level: number }[]; ctaHref: string; ctaLabel: string;
};

export function BlogPostView(p: BlogPostViewProps) {
  const { d, line, card, chip } = useTokens(p.design);
  const [copied, setCopied] = useState(false);
  const base = `/store/${p.store.slug}`;
  const share = encodeURIComponent(p.url);
  const text = encodeURIComponent(p.post.title);
  const shareBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 999, border: `1px solid ${line}`, display: "grid", placeItems: "center", background: "transparent", color: d.text, cursor: "pointer" };
  return (
    <Shell store={p.store} design={p.design} crumbs={[]}>
      <article>
        <header style={{ background: d.surface, borderBottom: `1px solid ${line}` }}>
          <div style={{ width: "min(780px,calc(100% - 32px))", margin: "0 auto", padding: "44px 0 32px" }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: d.muted, marginBottom: 16 }}>
              <Link href={base}>Home</Link> / <Link href={`${base}/blog`}>Blog</Link>{p.post.category && <> / <Link href={`${base}/blog?category=${p.post.category.slug}`}>{p.post.category.name}</Link></>}
            </nav>
            <h1 style={{ fontFamily: d.headingFont, fontSize: 42, lineHeight: 1.12, margin: 0 }}>{p.post.title}</h1>
            {p.post.excerpt && <p style={{ color: d.muted, fontSize: 19, lineHeight: 1.6, margin: "14px 0 0" }}>{p.post.excerpt}</p>}
            <div style={{ color: d.muted, fontSize: 14, marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ color: d.text }}>{p.post.author}</strong><span aria-hidden>·</span><time>{p.post.date}</time><span aria-hidden>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={14} />{p.post.minutes} min read</span>
            </div>
          </div>
        </header>
        <div style={{ width: "min(780px,calc(100% - 32px))", margin: "0 auto", padding: "32px 0 0" }}>
          {p.post.image && <div role="img" aria-label={p.post.imageAlt} style={{ aspectRatio: "16/9", borderRadius: d.radius, background: `url(${cssUrl(p.post.image)}) center/cover`, border: `1px solid ${line}`, marginBottom: 36 }} />}
          {p.toc.length >= 3 && (
            <nav aria-label="In this post" style={{ ...card, padding: "16px 20px", marginBottom: 32 }}>
              <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em", color: d.muted }}>In this post</strong>
              <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: 15 }}>
                {p.toc.map((t) => <li key={t.id} style={{ marginLeft: t.level === 3 ? 16 : 0 }}><a href={`#${t.id}`} style={{ color: d.accent }}>{t.text}</a></li>)}
              </ol>
            </nav>
          )}
          {p.children}

          {p.post.tags.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "36px 0 0" }}>{p.post.tags.map((t) => <Link key={t} href={`${base}/blog?tag=${encodeURIComponent(t)}`} style={{ ...chip(false), fontSize: 12, padding: "5px 11px" }}>#{t}</Link>)}</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "28px 0 0", paddingTop: 22, borderTop: `1px solid ${line}` }}>
            <strong style={{ fontSize: 14 }}>Share</strong>
            <a style={shareBtn} href={`https://wa.me/?text=${text}%20${share}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><MessageCircle size={16} /></a>
            <a style={shareBtn} href={`https://twitter.com/intent/tweet?text=${text}&url=${share}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X"><Twitter size={16} /></a>
            <a style={shareBtn} href={`https://www.facebook.com/sharer/sharer.php?u=${share}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><Facebook size={16} /></a>
            <button type="button" style={shareBtn} aria-label="Copy link" onClick={() => { navigator.clipboard?.writeText(p.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => null); }}><Link2 size={16} /></button>
            {copied && <span style={{ fontSize: 13, color: d.muted }}>Link copied</span>}
          </div>

          <div style={{ ...card, padding: 28, margin: "36px 0 0", textAlign: "center" }}>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 24, margin: 0 }}>Talk to {p.store.name}</h2>
            <p style={{ color: d.muted, margin: "8px 0 18px" }}>Questions about this post? We’re happy to help.</p>
            <Link href={p.ctaHref} style={{ display: "inline-block", padding: "12px 24px", fontWeight: 750, fontSize: 14, borderRadius: d.buttonStyle === "pill" ? 999 : d.radius, background: d.primary, color: "#fff" }}>{p.ctaLabel}</Link>
          </div>

          {(p.newer || p.older) && (
            <nav aria-label="More posts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "36px 0 0" }}>
              {p.older ? <Link href={`${base}/blog/${p.older.slug}`} style={{ ...card, padding: 16 }}><small style={{ color: d.muted }}>← Older</small><div style={{ fontWeight: 700, marginTop: 4 }}>{p.older.title}</div></Link> : <span />}
              {p.newer ? <Link href={`${base}/blog/${p.newer.slug}`} style={{ ...card, padding: 16, textAlign: "right" }}><small style={{ color: d.muted }}>Newer →</small><div style={{ fontWeight: 700, marginTop: 4 }}>{p.newer.title}</div></Link> : <span />}
            </nav>
          )}
        </div>

        {p.related.length > 0 && (
          <section className="bn-wrap" style={{ padding: "56px 0 0" }}>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 26, margin: "0 0 20px" }}>Keep reading</h2>
            <div className="bn-grid bn-blog-cols">{p.related.map((r) => <PostCard key={r.id} post={r} base={base} design={p.design} />)}</div>
          </section>
        )}
      </article>
      <div style={{ height: 56 }} />
    </Shell>
  );
}

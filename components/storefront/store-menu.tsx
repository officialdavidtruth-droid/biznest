"use client";

import Link from "next/link";
import { createContext, Fragment, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { storePath, type ResolvedMenuItem } from "@/lib/storefront-menu";

const MenuContext = createContext<ResolvedMenuItem[] | null>(null);

/** Supplies the owner's custom header menu (or null = use template defaults). */
export function StoreMenuProvider({ menu, children }: { menu: ResolvedMenuItem[] | null; children: ReactNode }) {
  return <MenuContext.Provider value={menu && menu.length ? menu : null}>{children}</MenuContext.Provider>;
}

/** [label, path]. `path` is relative to the store ("/about"), an in-page anchor ("#catalog") or a full URL. */
export type FallbackLink = [label: string, path: string];

function fallbackHref(slug: string, path: string) {
  return path.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(path) ? path : storePath(slug, path);
}

/**
 * Drop-in replacement for a template's hardcoded header links.
 *
 *   <nav><MenuLinks slug={slug} fallback={[["Home","/"],["About","/about"]]} /></nav>
 *
 * - If the owner built a menu in Dashboard > Menus, that menu is rendered
 *   (top-level links, with a dropdown for any item that has children).
 * - Otherwise the template's own `fallback` links render, so nothing changes
 *   for stores that never customize.
 * Top-level items are plain <a> children of the parent <nav>, so each
 * template's existing `nav a` CSS keeps styling them.
 */
export function MenuLinks({
  slug,
  fallback = [],
  fallbackNode,
  upper = false,
  active,
  onNavigate,
  linkStyle,
  linkClassName,
  wrap,
}: {
  slug: string;
  /** Simple default links, used when the owner has no custom menu. */
  fallback?: FallbackLink[];
  /** Or the template's own original JSX, rendered untouched when there is no custom menu. */
  fallbackNode?: ReactNode;
  upper?: boolean;
  active?: string;
  onNavigate?: () => void;
  /** Inline style applied to every top-level link so it matches the template's own links. */
  linkStyle?: CSSProperties;
  linkClassName?: string;
  /** Wrap each top-level item in <li> for templates that render a <ul>. */
  wrap?: "li";
}) {
  const custom = useContext(MenuContext);
  const [openId, setOpenId] = useState<string | null>(null);
  const fmt = (s: string) => (upper ? s.toUpperCase() : s);
  const wrapIt = (key: string, node: ReactNode) => (wrap === "li" ? <li key={key}>{node}</li> : <Fragment key={key}>{node}</Fragment>);
  const cls = (isActive: boolean) => [linkClassName, isActive ? "active" : ""].filter(Boolean).join(" ") || undefined;

  if (!custom && fallbackNode !== undefined) return <>{fallbackNode}</>;

  if (!custom) {
    return (
      <>
        {fallback.map(([label, path]) => wrapIt(label,
            <Link
              href={fallbackHref(slug, path)}
              className={cls(!!active && active.toLowerCase() === label.toLowerCase())}
              style={linkStyle}
              onClick={onNavigate}
            >
              {fmt(label)}
            </Link>
        ))}
      </>
    );
  }

  const linkProps = (i: ResolvedMenuItem) => ({
    target: i.newTab ? "_blank" : undefined,
    rel: i.newTab || i.external ? "noopener noreferrer" : undefined,
  });

  return (
    <>
      <style>{MENU_CSS}</style>
      {custom.map((item) => {
        const isActive = !!active && active.toLowerCase() === item.label.toLowerCase();
        if (item.children.length === 0) {
          return wrapIt(item.id,
            <Link href={item.href} className={cls(isActive)} style={linkStyle} onClick={onNavigate} {...linkProps(item)}>
              {fmt(item.label)}
            </Link>
          );
        }
        const open = openId === item.id;
        return wrapIt(item.id,
          <span
            className={`bn-menu-item${open ? " is-open" : ""}`}
            onMouseEnter={() => setOpenId(item.id)}
            onMouseLeave={() => setOpenId((cur) => (cur === item.id ? null : cur))}
          >
            <Link
              href={item.href}
              className={cls(isActive)}
              style={linkStyle}
              aria-haspopup="true"
              aria-expanded={open}
              onClick={(e) => {
                // Touch devices have no hover: first tap opens the dropdown, second tap follows the link.
                if (!open && window.matchMedia("(hover: none)").matches) {
                  e.preventDefault();
                  setOpenId(item.id);
                } else onNavigate?.();
              }}
              {...linkProps(item)}
            >
              {fmt(item.label)} <span className="bn-menu-caret" aria-hidden>▾</span>
            </Link>
            <span className="bn-menu-sub" role="menu">
              {item.children.map((c) => (
                <Link key={c.id} href={c.href} role="menuitem" className="bn-menu-sublink" onClick={onNavigate} {...linkProps(c)}>
                  {c.label}
                </Link>
              ))}
            </span>
          </span>
        );
      })}
    </>
  );
}

// Self-contained so it works inside every template's differently-styled header.
// Selectors are deliberately more specific than templates' `nav a` rules.
const MENU_CSS = `
.bn-menu-item{position:relative;display:inline-flex;align-items:center}
.bn-menu-item .bn-menu-caret{font-size:.7em;opacity:.7}
.bn-menu-item .bn-menu-sub{display:none;position:absolute;top:100%;left:0;min-width:210px;padding:8px;margin:0;z-index:100;
 background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;box-shadow:0 18px 40px -18px rgba(0,0,0,.4);flex-direction:column;gap:2px}
.bn-menu-item.is-open .bn-menu-sub{display:flex}
.bn-menu .bn-menu-sub a.bn-menu-sublink,.bn-menu-item .bn-menu-sub a.bn-menu-sublink{display:block;padding:9px 12px;border-radius:8px;
 color:#1a1a1a;font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;white-space:nowrap;text-decoration:none;background:transparent;border:0}
.bn-menu-item .bn-menu-sub a.bn-menu-sublink:hover{background:rgba(0,0,0,.06)}
@media (max-width:900px){
 .bn-menu-item{display:flex;flex-direction:column;align-items:flex-start;width:100%}
 .bn-menu-item .bn-menu-sub{position:static;box-shadow:none;border:0;background:transparent;padding:0 0 0 14px;min-width:0}
 .bn-menu-item .bn-menu-sub a.bn-menu-sublink{color:inherit;padding:7px 0}
}
`;

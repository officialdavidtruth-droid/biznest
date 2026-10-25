"use client";

import Link from "next/link";
import "./floating-tab-bar.css";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

type IconType = LucideIcon;

export type FloatingTab = {
  key: string;
  label: string;
  href: string;
  icon: IconType;
  active: boolean;
  /** Fill the icon when active (good for Home/User, bad for Search). */
  filled?: boolean;
};

export type FloatingCenter = {
  label: string;
  icon: IconType;
  /** Provide href for a link, or onClick for a button. */
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
  /** Rendered as data-tour so the onboarding tour can spotlight the button. */
  tourId?: string;
};

/**
 * Floating bottom bar: a lime surface with a half-circle notch and a raised
 * round action button sitting in it. Tabs split evenly either side of the
 * centre button; the active tab gets a filled icon and a bold label.
 * Shared by the storefront tab bar and the merchant dashboard chrome.
 */
export function FloatingTabBar({
  tabs,
  center,
  ariaLabel = "Main",
  className = "",
}: {
  tabs: FloatingTab[];
  center: FloatingCenter;
  ariaLabel?: string;
  className?: string;
}) {
  const split = Math.ceil(tabs.length / 2);
  const left = tabs.slice(0, split);
  const right = tabs.slice(split);
  const CenterIcon = center.icon;
  const columns = `repeat(${left.length}, minmax(0, 1fr)) var(--fb-gap) repeat(${right.length}, minmax(0, 1fr))`;

  const renderTab = (t: FloatingTab) => {
    const Icon = t.icon;
    return (
      <Link
        key={t.key}
        href={t.href}
        className={`bn-fbar-tab ${t.active ? "bn-fbar-tab-active" : ""}`}
        aria-current={t.active ? "page" : undefined}
      >
        <Icon
          className="bn-fbar-icon h-[22px] w-[22px]"
          strokeWidth={t.active ? 2.3 : 1.9}
          fill={t.active && t.filled ? "currentColor" : "none"}
        />
        <span className="bn-fbar-label">{t.label}</span>
      </Link>
    );
  };

  const centerBody = (
    <>
      <CenterIcon className="h-[26px] w-[26px]" strokeWidth={2} />
      {!!center.badge && (
        <span key={center.badge} className="bn-fbar-badge">
          {center.badge > 99 ? "99+" : center.badge}
        </span>
      )}
    </>
  );
  const centerClass = `bn-fbar-center ${center.active ? "bn-fbar-center-active" : ""}`;

  return (
    <nav className={`bn-fbar ${className}`} aria-label={ariaLabel}>
      <div className="bn-fbar-surface" style={{ gridTemplateColumns: columns } as CSSProperties}>
        {left.map(renderTab)}
        <span aria-hidden />
        {right.map(renderTab)}
      </div>
      {center.href ? (
        <Link href={center.href} className={centerClass} aria-label={center.label} data-tour={center.tourId}>
          {centerBody}
        </Link>
      ) : (
        <button type="button" onClick={center.onClick} className={centerClass} aria-label={center.label} data-tour={center.tourId}>
          {centerBody}
        </button>
      )}
    </nav>
  );
}

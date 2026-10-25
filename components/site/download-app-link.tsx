"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { isRunningAsApp } from "@/components/site/install-app-prompt";

/**
 * Link to /download that disappears once the visitor is already inside the
 * BizNest app (native shell or installed PWA). Styling is passed in so the
 * homepage's own design tokens stay in page.tsx.
 */
export function DownloadAppLink({
  className,
  style,
  children,
  icon = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  icon?: boolean;
}) {
  const [hide, setHide] = useState(false);
  useEffect(() => setHide(isRunningAsApp()), []);
  if (hide) return null;
  return (
    <Link href="/download" className={className} style={style}>
      {icon && <Download className="mr-2 inline h-4 w-4 align-[-2px]" aria-hidden />}
      {children}
    </Link>
  );
}

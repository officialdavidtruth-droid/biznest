import type { ReactNode } from "react";
import { AppsBackBar } from "./apps-back-bar";

export default async function AppsLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="space-y-4">
    <AppsBackBar slug={slug} />
    {children}
  </div>;
}

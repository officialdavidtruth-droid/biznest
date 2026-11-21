"use client";
import { usePathname } from "next/navigation";

/** The orders page brings its own restaurant header and footer; every other account page keeps the standard account shell. */
export function RestaurantAccountFrame({ legacy, children }: { legacy: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname() || "";
  return path.replace(/\/+$/, "").endsWith("/account/orders") ? <>{children}</> : <>{legacy}</>;
}

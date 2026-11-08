"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * On phones, SupaAdmin tables turn into one card per row (see .bn-admin-main in globals.css).
 * The card needs each cell's column name, so copy it from the table header onto every cell.
 * Re-runs on navigation and when a page adds rows later (filters, "load more").
 */
export function SupaAdminStackTables({ rootSelector }: { rootSelector: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const label = () => {
      root.querySelectorAll("table").forEach((table) => {
        const heads = Array.from(table.querySelectorAll("thead th")).map((th) => (th.textContent ?? "").trim());
        if (heads.length === 0) return;
        table.classList.add("bn-stack");
        table.querySelectorAll("tbody tr").forEach((tr) => {
          Array.from(tr.children).forEach((td, i) => {
            if (td instanceof HTMLElement && !td.dataset.label && heads[i]) td.dataset.label = heads[i];
          });
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [pathname, rootSelector]);
  return null;
}

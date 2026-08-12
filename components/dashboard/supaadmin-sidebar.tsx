"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShieldCheck, Users, Store, CreditCard,
  Globe, FileClock, Settings, Gavel, Activity,
} from "lucide-react";

type Group = {
  label: string;
  items: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    badgeKey?: "pendingBusinesses" | "openDisputes";
  }[];
};

const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [{ href: "/supaadmin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/supaadmin/stores", label: "Stores", icon: Store },
      { href: "/supaadmin/users", label: "Users", icon: Users },
      { href: "/supaadmin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/supaadmin/domains", label: "Domains", icon: Globe },
    ],
  },
  {
    label: "Trust & safety",
    items: [
      { href: "/supaadmin/businesses", label: "Business verification", icon: ShieldCheck, badgeKey: "pendingBusinesses" },
      { href: "/supaadmin/disputes", label: "Disputes", icon: Gavel, badgeKey: "openDisputes" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/supaadmin/system-health", label: "System health", icon: Activity },
      { href: "/supaadmin/logs", label: "Activity log", icon: FileClock },
      { href: "/supaadmin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function SupaAdminSidebarNav({
  counts,
}: {
  counts: { pendingBusinesses: number; openDisputes: number };
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p
            className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "hsl(var(--muted-foreground) / 0.8)" }}
          >
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/supaadmin" ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              const badge = item.badgeKey ? counts[item.badgeKey] : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                  style={{
                    color: active ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    background: active ? "var(--bn-accent-gradient)" : "transparent",
                    boxShadow: active ? "0 4px 14px rgba(52, 211, 153, 0.25)" : "none",
                  }}
                >
                  {!active && (
                    <span
                      className="absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: "hsl(var(--foreground) / 0.05)" }}
                    />
                  )}
                  <Icon size={14} className="relative shrink-0" />
                  <span className="relative flex-1 truncate">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className="relative flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                      style={{
                        background: active ? "hsl(var(--background) / 0.25)" : "var(--bn-accent-gradient)",
                        color: active ? "hsl(var(--primary-foreground))" : "hsl(var(--primary-foreground))",
                      }}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

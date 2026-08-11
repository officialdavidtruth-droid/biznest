import Link from "next/link";
import {
  LayoutDashboard, ShieldCheck, Users, Store, CreditCard,
  Globe, FileClock, Settings, ShieldAlert, Gavel, Activity,
} from "lucide-react";
import { SupaAdminLogoutButton } from "@/components/dashboard/supaadmin-logout-button";

// Auth for everything under /supaadmin is enforced in middleware.ts via the
// ADMIN_PIN cookie, before this layout ever renders — nothing to check here.

const LINKS = [
  { href: "/supaadmin", label: "Overview", icon: LayoutDashboard },
  { href: "/supaadmin/businesses", label: "Business verification", icon: ShieldCheck },
  { href: "/supaadmin/users", label: "Users", icon: Users },
  { href: "/supaadmin/stores", label: "Stores", icon: Store },
  { href: "/supaadmin/disputes", label: "Disputes", icon: Gavel },
  { href: "/supaadmin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/supaadmin/domains", label: "Domains", icon: Globe },
  { href: "/supaadmin/system-health", label: "System health", icon: Activity },
  { href: "/supaadmin/logs", label: "Activity log", icon: FileClock },
  { href: "/supaadmin/settings", label: "Settings", icon: Settings },
];

export default function SupaAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex min-h-screen" style={{ background: "hsl(var(--background))" }}>
      <aside
        className="flex w-60 shrink-0 flex-col border-r"
        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted))" }}
      >
        <div className="flex items-center gap-2.5 border-b px-4 py-4" style={{ borderColor: "hsl(var(--border))" }}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "hsl(var(--primary))" }}
          >
            <ShieldAlert size={15} style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>
          <div>
            <p className="text-xs font-bold leading-tight" style={{ color: "hsl(var(--foreground))" }}>
              SupaAdmin
            </p>
            <p className="text-[10px] leading-tight" style={{ color: "hsl(var(--muted-foreground))" }}>
              BizNest Platform
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                <Icon size={14} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3" style={{ borderColor: "hsl(var(--border))" }}>
          <SupaAdminLogoutButton />
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

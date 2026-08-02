"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Users, Boxes, Ticket,
  CreditCard, BarChart3, Star, Megaphone, MessageSquare, LayoutTemplate,
  Settings, BadgeCheck, CreditCard as SubIcon, LifeBuoy,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Products", href: "/products", icon: Package },
  { label: "Services", href: "/services", icon: Wrench },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Coupons", href: "/coupons", icon: Ticket },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reviews", href: "/reviews", icon: Star },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Website Builder", href: "/builder", icon: LayoutTemplate },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Verification Status", href: "/verification", icon: BadgeCheck },
  { label: "Subscription", href: "/subscription", icon: SubIcon },
  { label: "Support", href: "/support", icon: LifeBuoy },
];

export function DashboardSidebar({ slug, storeName }: { slug: string; storeName: string }) {
  const pathname = usePathname();
  const base = `/store/${slug}/admin`;

  return (
    <aside className="w-64 shrink-0 border-r bg-background p-4">
      <div className="mb-6 px-2">
        <p className="truncate text-sm font-semibold">{storeName}</p>
        <p className="truncate text-xs text-muted-foreground">/store/{slug}</p>
      </div>
      <nav className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const href = `${base}${item.href}`;
          const isActive = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={href}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

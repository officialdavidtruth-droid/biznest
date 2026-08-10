import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Package, Calendar, Heart, Store,
  MapPin, Clock, MessageSquare, Star, ShoppingBag, Gift,
} from "lucide-react";

const LINKS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/account/bookings", label: "Bookings", icon: Calendar },
  { href: "/account/loyalty", label: "Loyalty points", icon: Gift },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/favorites", label: "Favorite businesses", icon: Store },
  { href: "/account/recently-viewed", label: "Recently viewed", icon: Clock },
  { href: "/account/carts", label: "Saved carts", icon: ShoppingBag },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/messages", label: "Messages", icon: MessageSquare },
  { href: "/account/reviews", label: "Reviews", icon: Star },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as {session.user.email ?? session.user.name}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getAccountOverview } from "@/lib/actions/account";
import { Package, Calendar, Heart, Store, Star, MessageSquare } from "lucide-react";

const TILES = [
  { key: "orderCount" as const, href: "/account/orders", label: "Orders", icon: Package, color: "from-violet-600 to-indigo-600" },
  { key: "bookingCount" as const, href: "/account/bookings", label: "Bookings", icon: Calendar, color: "from-blue-500 to-cyan-400" },
  { key: "wishlistCount" as const, href: "/account/wishlist", label: "Wishlist items", icon: Heart, color: "from-pink-500 to-rose-400" },
  { key: "favoriteCount" as const, href: "/account/favorites", label: "Favorite businesses", icon: Store, color: "from-emerald-500 to-teal-400" },
  { key: "reviewCount" as const, href: "/account/reviews", label: "Reviews written", icon: Star, color: "from-orange-500 to-amber-400" },
  { key: "unreadMessages" as const, href: "/account/messages", label: "Unread messages", icon: MessageSquare, color: "from-indigo-500 to-blue-400" },
];

export default async function AccountOverviewPage() {
  const overview = await getAccountOverview();

  if (!overview) {
    return <p className="text-sm text-slate-500">Couldn't load your account overview.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {TILES.map(({ key, href, label, icon: Icon, color }) => (
        <Link
          key={key}
          href={href}
          className={`rounded-2xl bg-gradient-to-br ${color} p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}
        >
          <Icon className="mb-3 h-5 w-5 opacity-90" />
          <div className="text-2xl font-extrabold">{overview[key]}</div>
          <div className="mt-1 text-sm opacity-90">{label}</div>
        </Link>
      ))}
    </div>
  );
}

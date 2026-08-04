import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SupaAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/supaadmin");
  if (session.user.role !== "PLATFORM_ADMIN" && session.user.role !== "SUPPORT_MODERATOR") {
    redirect("/");
  }

  const links = [
    { href: "/supaadmin", label: "Overview" },
    { href: "/supaadmin/businesses", label: "Business verification" },
    { href: "/supaadmin/users", label: "Users" },
    { href: "/supaadmin/stores", label: "Stores" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-background p-4">
        <p className="mb-4 px-2 text-sm font-semibold">BizNest Platform</p>
        <nav className="space-y-0.5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-muted/20 p-6">{children}</main>
    </div>
  );
}

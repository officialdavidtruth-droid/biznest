 import Link from "next/link";
import { Puzzle, type LucideIcon } from "lucide-react";

/**
 * Shown in place of a plugin's workspace when the store hasn't installed it,
 * doesn't have plan access, or the viewer lacks permission — instead of
 * bouncing them away to the Apps catalog. Message comes straight from the
 * entitlement/access check, so it reflects the real reason (not installed,
 * wrong plan, no permission) rather than a generic "redirected" dead end.
 */
export function PluginInstallGate({ slug, title, message, icon: Icon = Puzzle }: { slug: string; title: string; message?: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-3xl border bg-background p-10 text-center">
      <Icon className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message || "Install this app to use it."}</p>
      <Link href={`/store/${slug}/admin/apps`} className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Apps</Link>
    </div>
  );
}

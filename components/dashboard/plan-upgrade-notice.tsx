import Link from "next/link";
import { Lock } from "lucide-react";

/** Shown in place of a dashboard page the store's plan doesn't include. The menu entry stays so the feature is discoverable. */
export function PlanUpgradeNotice({ slug, title, message }: { slug: string; title: string; message: string }) {
  return (
    <div className="rounded-3xl border bg-background p-10 text-center">
      <Lock className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <Link href={`/store/${slug}/admin/subscription`} className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
        Upgrade plan
      </Link>
    </div>
  );
}

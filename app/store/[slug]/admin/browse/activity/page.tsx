import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ActivityTab } from "@/components/dashboard/browse-tabs";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/browse/activity`);
  return <ActivityTab userId={s.user.id} />;
}

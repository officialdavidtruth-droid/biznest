import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinForm } from "@/components/forms/join-form";

export const metadata: Metadata = { title: "Join BizNest to follow businesses", robots: { index: false } };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const safe = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/browse";
  const session = await auth();
  if (session?.user?.id) redirect(safe);
  return (
    <AuthShell eyebrow="Join" title="Join BizNest" subtitle="Create a free account to follow your favourite businesses and keep up with what they post.">
      <JoinForm callbackUrl={safe} />
    </AuthShell>
  );
}

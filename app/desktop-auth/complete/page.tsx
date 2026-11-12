import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isChallenge, signHandoff } from "@/lib/desktop-handoff";
import { ReturnToApp } from "./return-to-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Return to BizNest", robots: { index: false } };

export default async function DesktopAuthComplete({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const { challenge } = await searchParams;
  if (!isChallenge(challenge)) redirect("/login");
  const session = await auth();
  if (!session?.user?.id) redirect(`/desktop-auth/start?challenge=${challenge}`);
  return <ReturnToApp url={`biznest://auth?code=${encodeURIComponent(signHandoff(session.user.id, challenge))}`} />;
}

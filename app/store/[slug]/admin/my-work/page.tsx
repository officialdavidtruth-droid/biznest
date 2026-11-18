import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyWork } from "@/lib/actions/hr-biometrics";
import { MyWork } from "@/components/dashboard/my-work";

export const dynamic = "force-dynamic";

export default async function MyWorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/my-work`);
  const data = await getMyWork(slug);
  if ("error" in data) {
    return (
      <div className="bn-admin-page max-w-xl space-y-2">
        <h1 className="text-2xl font-bold">My work</h1>
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {data.error === "NOT_LINKED"
            ? "Your login isn't linked to an employee record yet. Ask HR to add you in HR & Payroll with the same email you sign in with, or to link your login there."
            : data.error}
        </p>
      </div>
    );
  }
  return <MyWork slug={slug} data={data} />;
}

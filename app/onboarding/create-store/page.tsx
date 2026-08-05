import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CreateStoreForm } from "@/components/forms/create-store-form";

export default async function CreateStorePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding/create-store");

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    include: { store: true },
  });

  if (!business) redirect("/onboarding/business-verification");
  if (business.verificationStatus !== "APPROVED") redirect("/onboarding/business-verification");
  if (!business.fraudPolicyAcceptedAt) redirect("/onboarding/fraud-policy");
  if (business.store) redirect(`/store/${business.store.slug}/admin`);

  const templates = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  // A store doesn't exist yet at this point, so there's no subscription to
  // check — every new store starts on Free (rank 1). Premium templates
  // still show here, locked, as an upgrade nudge, rather than being hidden
  // entirely — same gallery behavior as the post-creation builder page.

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Name your store</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your store gets a public page and an admin dashboard automatically.
      </p>
      <CreateStoreForm businessId={business.id} templates={templates} planRank={1} />
    </div>
  );
}

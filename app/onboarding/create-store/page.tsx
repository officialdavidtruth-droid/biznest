import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { StoreSetupWizard } from "@/components/forms/store-setup-wizard";

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
      <StoreSetupWizard
        businessId={business.id}
        business={{
          businessName: business.businessName,
          category: business.category,
          sellsProducts: business.sellsProducts,
          offersServices: business.offersServices,
        }}
        templates={templates}
        planRank={1}
      />
    </div>
  );
}

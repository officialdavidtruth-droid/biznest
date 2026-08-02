import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FRAUD_POLICY_TEXT } from "@/lib/constants/fraud-policy";
import { FraudPolicyForm } from "@/components/forms/fraud-policy-form";

export default async function FraudPolicyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding/fraud-policy");

  const business = await prisma.business.findUnique({ where: { userId: session.user.id } });
  if (!business) redirect("/onboarding/business-verification");
  if (business.verificationStatus !== "APPROVED") {
    redirect("/onboarding/business-verification");
  }
  if (business.fraudPolicyAcceptedAt) {
    redirect("/onboarding/create-store");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Seller agreement</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Please read and accept this policy before opening your store.
      </p>

      <div className="mb-6 max-h-72 overflow-y-auto whitespace-pre-line rounded-md border bg-muted/40 p-4 text-sm">
        {FRAUD_POLICY_TEXT}
      </div>

      <FraudPolicyForm businessId={business.id} />
    </div>
  );
}

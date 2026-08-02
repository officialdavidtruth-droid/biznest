import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BusinessVerificationForm } from "@/components/forms/business-verification-form";

export default async function BusinessVerificationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding/business-verification");

  const existing = await prisma.business.findUnique({ where: { userId: session.user.id } });

  if (existing?.verificationStatus === "PENDING") {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Verification in review</h1>
        <p className="text-sm text-muted-foreground">
          We're reviewing your business details and documents. This usually takes 1–3 business days.
          We'll email you once a decision is made.
        </p>
      </div>
    );
  }

  if (existing?.verificationStatus === "APPROVED") {
    redirect("/onboarding/fraud-policy");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Verify your business</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every seller on BizNest must complete verification before opening a store. This protects
        buyers and keeps the marketplace trustworthy.
      </p>
      <BusinessVerificationForm
        existingRejection={existing?.verificationStatus === "REJECTED" ? existing.rejectionReason : null}
      />
    </div>
  );
}

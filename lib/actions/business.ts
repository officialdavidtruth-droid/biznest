"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  businessVerificationSchema,
  fraudPolicyAcceptanceSchema,
  type BusinessVerificationInput,
} from "@/lib/validations/business";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

/**
 * Step 1 of onboarding: submit business details + KYC documents.
 * Creates the Business row in PENDING status. Does NOT grant STORE_OWNER
 * role or unlock store creation — that only happens after admin approval
 * AND fraud policy acceptance (see acceptFraudPolicy / the admin approval
 * action in lib/actions/admin.ts, phase 2).
 */
export async function submitBusinessVerification(
  input: BusinessVerificationInput
): Promise<ActionResult<{ businessId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = businessVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const existing = await prisma.business.findUnique({ where: { userId: session.user.id } });
  if (existing && existing.verificationStatus !== "REJECTED") {
    return { success: false, error: "You already have a business verification on file." };
  }

  const data = parsed.data;

  const business = await prisma.business.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      businessName: data.businessName,
      category: data.category,
      description: data.description,
      phone: data.phone,
      email: data.email,
      country: data.country,
      state: data.state,
      city: data.city,
      sellsProducts: data.sellsProducts,
      offersServices: data.offersServices,
      registrationType: data.registrationType,
      registrationCertUrl: data.registrationType === "REGISTERED" ? data.registrationCertUrl : null,
      governmentIdUrl: data.registrationType === "UNREGISTERED" ? data.governmentIdUrl : null,
      selfieUrl: data.registrationType === "UNREGISTERED" ? data.selfieUrl : null,
      verificationStatus: "PENDING",
      ...(data.registrationType === "UNREGISTERED"
        ? { guarantors: { create: data.guarantors } }
        : {}),
    },
    update: {
      businessName: data.businessName,
      category: data.category,
      description: data.description,
      phone: data.phone,
      email: data.email,
      country: data.country,
      state: data.state,
      city: data.city,
      sellsProducts: data.sellsProducts,
      offersServices: data.offersServices,
      registrationType: data.registrationType,
      registrationCertUrl: data.registrationType === "REGISTERED" ? data.registrationCertUrl : null,
      governmentIdUrl: data.registrationType === "UNREGISTERED" ? data.governmentIdUrl : null,
      selfieUrl: data.registrationType === "UNREGISTERED" ? data.selfieUrl : null,
      verificationStatus: "PENDING",
      rejectionReason: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "BUSINESS_VERIFICATION_SUBMITTED",
      entity: "Business",
      entityId: business.id,
    },
  });

  revalidatePath("/onboarding");
  return { success: true, data: { businessId: business.id } };
}

/**
 * Step 2 of onboarding: seller must explicitly accept the fraud policy
 * before store creation is unlocked. Required regardless of verification
 * status so acceptance is on record from day one.
 */
export async function acceptFraudPolicy(
  input: unknown
): Promise<ActionResult<{ businessId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = fraudPolicyAcceptanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "You must accept the fraud policy to continue." };
  }

  const business = await prisma.business.findUnique({ where: { id: parsed.data.businessId } });
  if (!business || business.userId !== session.user.id) {
    return { success: false, error: "Business not found." };
  }

  await prisma.business.update({
    where: { id: business.id },
    data: { fraudPolicyAcceptedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "FRAUD_POLICY_ACCEPTED",
      entity: "Business",
      entityId: business.id,
    },
  });

  revalidatePath("/onboarding");
  return { success: true, data: { businessId: business.id } };
}

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  businessVerificationSchema,
  fraudPolicyAcceptanceSchema,
  type BusinessVerificationInput,
} from "@/lib/validations/business";
import { revalidatePath } from "next/cache";
import { BUSINESS_TYPES } from "@/lib/capabilities";
import { isValidSubcategory } from "@/lib/business-subcategories";
import { isValidStateForCountry } from "@/lib/geo";
import type { ActionResult } from "@/types/actions";
import { isOwnKycUrl } from "@/lib/kyc-storage";

function pathFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

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
      // Full dotted paths (e.g. "guarantors.1.email") so the form can mark the
      // exact guarantor field -- flatten() only reports the top-level key.
      fieldErrors: pathFieldErrors(parsed.error.issues),
    };
  }

  // State must be one of the chosen country's states (free text only for
  // countries the dataset has no states for).
  if (!(await isValidStateForCountry(parsed.data.country, parsed.data.state))) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: { state: ["Choose a state that belongs to the selected country"] },
    };
  }

  const existing = await prisma.business.findUnique({ where: { userId: session.user.id } });
  if (existing && existing.verificationStatus !== "REJECTED") {
    return { success: false, error: "You already have a business verification on file." };
  }

  const data = parsed.data;

  // KYC documents must be the private uploads made by THIS user (see
  // lib/kyc-storage.ts) -- not public URLs, and not someone else's files.
  const ownerId = session.user.id;
  const docUrls =
    data.registrationType === "REGISTERED"
      ? [data.registrationCertUrl]
      : [data.governmentIdUrl, data.selfieUrl, ...data.guarantors.map((g) => g.governmentIdUrl)];
  if (!docUrls.every((u) => isOwnKycUrl(u, ownerId))) {
    return { success: false, error: "One of your documents wasn't uploaded securely. Please re-upload your documents and try again." };
  }

  if (!BUSINESS_TYPES[data.category]) return { success: false, error: "Please select a supported business type." };

  // Only keep a specialty that belongs to the chosen category. The schema
  // already rejects a missing/invalid one for categories that have a list;
  // this also drops a stale value left over from a different category.
  const subcategory = isValidSubcategory(data.category, data.businessSubcategory) ? data.businessSubcategory! : null;

  // A rejected verification is a new KYC submission. Clear the previous
  // fraud-policy acceptance and replace the previous guarantor records so
  // stale/rejected identity data cannot silently carry into the new review.
  const isResubmission = Boolean(existing && existing.verificationStatus === "REJECTED");

  const business = await prisma.$transaction(async (tx) => {
    if (isResubmission && existing) {
      await tx.guarantor.deleteMany({ where: { businessId: existing.id } });
    }

    return tx.business.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        businessName: data.businessName,
        category: data.category,
        businessSubcategory: subcategory,
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
        businessSubcategory: subcategory,
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
        fraudPolicyAcceptedAt: isResubmission ? null : undefined,
        ...(data.registrationType === "UNREGISTERED"
          ? { guarantors: { create: data.guarantors } }
          : {}),
      },
    });
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

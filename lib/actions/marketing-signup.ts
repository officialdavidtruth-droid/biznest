"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { generateUniqueStoreSlug } from "@/lib/utils/slug";
import { canonicalizeBusinessType, CANONICAL_BUSINESS_TYPES } from "@/lib/business-identity";
import { marketingSignupSchema, type MarketingSignupInput } from "@/lib/schemas/marketing-signup";
import type { ActionResult } from "@/types/actions";

/**
 * The lightweight path into BizNest Marketing: no business verification
 * (government ID / registration cert / fraud policy), no template or plan
 * choice, no product/service setup -- just enough to know who the business
 * is and which niche's email templates to default to (see
 * lib/email/marketing-templates.ts, which already keys off businessType).
 *
 * Creates User + Business + Store in one transaction. The resulting store
 * is marked marketingOnly: true, which keeps it out of the full admin
 * dashboard entirely (see app/store/[slug]/admin/layout.tsx) and grants
 * standalone Marketing-tool access without a Business Mogul subscription
 * (see lib/access/marketing-tool.ts). Unlike registerUser (lib/actions/auth.ts),
 * this never routes through /onboarding/business-verification.
 *
 * The validation schema itself lives in lib/schemas/marketing-signup.ts,
 * not here -- this file's "use server" directive means only async function
 * exports are allowed, so a schema object defined here would be silently
 * dropped from any Client Component that imports it.
 */
export async function signUpForMarketing(
  input: MarketingSignupInput
): Promise<ActionResult<{ storeSlug: string }>> {
  const ip = getClientIp(await headers());
  const rateLimit = await checkRateLimit(`marketing-signup:${ip}`, 5, 60 * 60 * 1000); // 5/hour/IP
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many signups from this connection. Try again in ${Math.ceil((rateLimit.retryAfterSeconds ?? 3600) / 60)} minutes.`,
    };
  }

  const parsed = marketingSignupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  // Scoped to isMarketingOnly: true -- BizNest Marketing is a fully
  // separate product with its own accounts (see lib/access/marketing-tool.ts),
  // so an email already used for a main-platform account (isMarketingOnly:
  // false) must NOT block this signup. See the isMarketingOnly field on
  // User and the partial unique indexes in
  // prisma/migrations/20260921090000_split_marketing_identity_scope.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" }, customerScopeStoreId: null, isMarketingOnly: true },
  });
  if (existing) return { success: false, error: "An account with this email already exists. Try signing in instead." };

  const niche = canonicalizeBusinessType(parsed.data.niche);
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const slug = await generateUniqueStoreSlug(parsed.data.businessName);

  const store = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: parsed.data.name, email: normalizedEmail, passwordHash, role: "STORE_OWNER", isMarketingOnly: true },
    });
    const business = await tx.business.create({
      data: {
        userId: user.id,
        businessName: parsed.data.businessName,
        category: niche,
        sellsProducts: true,
        offersServices: true,
        description: parsed.data.description,
        phone: parsed.data.phone,
        email: normalizedEmail,
        country: parsed.data.country,
        state: parsed.data.state,
        city: parsed.data.city,
        registrationType: "UNREGISTERED",
        // Marketing-only businesses never sell or take payment through the
        // platform, so the identity/fraud review that gates real stores
        // (see createStore in lib/actions/store.ts) doesn't apply -- there's
        // nothing here for it to protect against.
        verificationStatus: "APPROVED",
        fraudPolicyAcceptedAt: new Date(),
      },
    });
    return tx.store.create({
      data: {
        businessId: business.id,
        name: parsed.data.businessName,
        slug,
        businessType: niche,
        marketingOnly: true,
        contactEmail: normalizedEmail,
        contactPhone: parsed.data.phone,
        onboardingProfile: {
          marketingOnly: true,
          website: parsed.data.website || null,
          address: parsed.data.address || null,
          country: parsed.data.country,
          state: parsed.data.state,
          city: parsed.data.city,
          description: parsed.data.description,
          niche,
        },
        themeColors: {
          primary: "#0b6b3a",
          secondary: "#064e2b",
          accent: "#22c55e",
          background: "#f0fdf4",
          text: "#102a1c",
        },
        fontFamily: "Inter",
      },
    });
  });

  return { success: true, data: { storeSlug: store.slug } };
}
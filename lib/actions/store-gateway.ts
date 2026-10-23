"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { APP_URL } from "@/lib/constants/app-url";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkFlutterwaveSecretKey,
  checkPaystackSecretKey,
  decryptSecret,
  encryptSecret,
  flutterwaveKeyMode,
  generateWebhookSecretHash,
  maskKey,
  paystackKeyMode,
  type GatewayProvider,
  type KeyMode,
} from "@/lib/payments/store-gateway";

/**
 * Store owners can collect customer payments in their OWN Paystack or
 * Flutterwave account. Only the business owner may view or change these keys
 * (staff members with "settings" access cannot).
 */
async function assertStoreOwner(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };
  if (store.business.userId !== session.user.id) {
    return { success: false as const, error: "Only the store owner can manage payment keys." };
  }
  return { success: true as const, store, userId: session.user.id };
}

export type OwnGatewaySettings = {
  enabled: boolean;
  provider: GatewayProvider | null;
  verifiedAt: string | null;
  paystack: { saved: boolean; secretMasked: string | null; publicKey: string | null; mode: KeyMode | null };
  flutterwave: { saved: boolean; secretMasked: string | null; publicKey: string | null; mode: KeyMode | null; secretHash: string | null };
  webhookUrls: { paystack: string; flutterwave: string };
};

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

export async function getOwnGatewaySettings(slug: string): Promise<OwnGatewaySettings | null> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return null;
  const { store } = access;

  const psSecret = safeDecrypt(store.ownPaystackSecretKey);
  const flwSecret = safeDecrypt(store.ownFlutterwaveSecretKey);
  const flwHash = safeDecrypt(store.ownFlutterwaveSecretHash);

  return {
    enabled: store.ownGatewayEnabled,
    provider: store.ownGatewayProvider === "PAYSTACK" || store.ownGatewayProvider === "FLUTTERWAVE" ? store.ownGatewayProvider : null,
    verifiedAt: store.ownGatewayVerifiedAt ? store.ownGatewayVerifiedAt.toISOString() : null,
    paystack: {
      saved: Boolean(store.ownPaystackSecretKey),
      secretMasked: maskKey(psSecret),
      publicKey: store.ownPaystackPublicKey,
      mode: psSecret ? paystackKeyMode(psSecret) : null,
    },
    flutterwave: {
      saved: Boolean(store.ownFlutterwaveSecretKey),
      secretMasked: maskKey(flwSecret),
      publicKey: store.ownFlutterwavePublicKey,
      mode: flwSecret ? flutterwaveKeyMode(flwSecret) : null,
      secretHash: flwHash,
    },
    webhookUrls: {
      paystack: `${APP_URL}/api/payments/paystack/webhook?store=${store.id}`,
      flutterwave: `${APP_URL}/api/payments/flutterwave/webhook?store=${store.id}`,
    },
  };
}

/**
 * Validates the keys against the gateway itself, encrypts the secret, and
 * switches the store to collect payments with them.
 */
export async function saveOwnGatewayKeys(
  slug: string,
  input: { provider: GatewayProvider; secretKey: string; publicKey?: string }
): Promise<ActionResult> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  const { store, userId } = access;

  const rate = await checkRateLimit(`own-gateway:${userId}`, 10, 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many attempts. Please wait a minute and try again." };

  const provider = input.provider;
  if (provider !== "PAYSTACK" && provider !== "FLUTTERWAVE") return { success: false, error: "Choose Paystack or Flutterwave." };

  const secretKey = (input.secretKey ?? "").trim();
  const publicKey = (input.publicKey ?? "").trim();
  if (!secretKey) return { success: false, error: "Enter your secret key." };

  const modeOf = provider === "PAYSTACK" ? paystackKeyMode : flutterwaveKeyMode;
  const secretMode = modeOf(secretKey);
  if (!secretMode || (provider === "PAYSTACK" && !secretKey.startsWith("sk_")) || (provider === "FLUTTERWAVE" && !secretKey.startsWith("FLWSECK"))) {
    return {
      success: false,
      error:
        provider === "PAYSTACK"
          ? "That doesn't look like a Paystack secret key. It starts with sk_live_ or sk_test_."
          : "That doesn't look like a Flutterwave secret key. It starts with FLWSECK-.",
    };
  }

  if (publicKey) {
    const publicMode = modeOf(publicKey);
    const prefixOk = provider === "PAYSTACK" ? publicKey.startsWith("pk_") : publicKey.startsWith("FLWPUBK");
    if (!publicMode || !prefixOk) {
      return {
        success: false,
        error:
          provider === "PAYSTACK"
            ? "That doesn't look like a Paystack public key. It starts with pk_live_ or pk_test_."
            : "That doesn't look like a Flutterwave public key. It starts with FLWPUBK-.",
      };
    }
    if (publicMode !== secretMode) {
      return { success: false, error: `Your public key is a ${publicMode} key but your secret key is a ${secretMode} key. Use a matching pair.` };
    }
  }

  const check = provider === "PAYSTACK" ? await checkPaystackSecretKey(secretKey) : await checkFlutterwaveSecretKey(secretKey);
  if (!check.ok) return { success: false, error: check.message ?? "Couldn't verify these keys." };

  let encrypted: string;
  let encryptedHash: string | undefined;
  try {
    encrypted = encryptSecret(secretKey);
    if (provider === "FLUTTERWAVE" && !store.ownFlutterwaveSecretHash) encryptedHash = encryptSecret(generateWebhookSecretHash());
  } catch {
    return { success: false, error: "Payment keys can't be stored securely right now. Please contact support." };
  }

  await prisma.store.update({
    where: { id: store.id },
    data:
      provider === "PAYSTACK"
        ? {
            ownPaystackSecretKey: encrypted,
            ownPaystackPublicKey: publicKey || null,
            ownGatewayProvider: "PAYSTACK",
            ownGatewayEnabled: true,
            ownGatewayVerifiedAt: new Date(),
          }
        : {
            ownFlutterwaveSecretKey: encrypted,
            ownFlutterwavePublicKey: publicKey || null,
            ...(encryptedHash ? { ownFlutterwaveSecretHash: encryptedHash } : {}),
            ownGatewayProvider: "FLUTTERWAVE",
            ownGatewayEnabled: true,
            ownGatewayVerifiedAt: new Date(),
          },
  });

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: undefined };
}

/** Switches between the owner's own gateway and the BizNest payout flow, or between their two providers. */
export async function setOwnGatewayActive(
  slug: string,
  input: { enabled: boolean; provider?: GatewayProvider }
): Promise<ActionResult> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  const { store } = access;

  if (!input.enabled) {
    await prisma.store.update({ where: { id: store.id }, data: { ownGatewayEnabled: false } });
    revalidatePath(`/store/${slug}/admin/payments`);
    return { success: true, data: undefined };
  }

  const provider = input.provider ?? (store.ownGatewayProvider === "PAYSTACK" || store.ownGatewayProvider === "FLUTTERWAVE" ? store.ownGatewayProvider : null);
  if (provider !== "PAYSTACK" && provider !== "FLUTTERWAVE") return { success: false, error: "Choose which gateway to use." };

  const hasKeys = provider === "PAYSTACK" ? Boolean(store.ownPaystackSecretKey) : Boolean(store.ownFlutterwaveSecretKey);
  if (!hasKeys) return { success: false, error: `Add your ${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"} keys first.` };

  await prisma.store.update({ where: { id: store.id }, data: { ownGatewayEnabled: true, ownGatewayProvider: provider } });
  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: undefined };
}

/** Deletes the saved keys for one provider. */
export async function removeOwnGatewayKeys(slug: string, provider: GatewayProvider): Promise<ActionResult> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  const { store } = access;

  if (provider !== "PAYSTACK" && provider !== "FLUTTERWAVE") return { success: false, error: "Unknown gateway." };

  // Payments still waiting on the customer need these keys to be verified.
  const inFlight = await prisma.payment.count({
    where: {
      storeId: store.id,
      usesStoreGateway: true,
      provider,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
  });
  if (inFlight > 0) {
    return {
      success: false,
      error: `${inFlight} customer payment${inFlight === 1 ? " is" : "s are"} still in progress with these keys. Try again once they finish.`,
    };
  }

  const wasActive = store.ownGatewayProvider === provider;
  await prisma.store.update({
    where: { id: store.id },
    data:
      provider === "PAYSTACK"
        ? { ownPaystackSecretKey: null, ownPaystackPublicKey: null, ...(wasActive ? { ownGatewayEnabled: false, ownGatewayProvider: null } : {}) }
        : { ownFlutterwaveSecretKey: null, ownFlutterwavePublicKey: null, ownFlutterwaveSecretHash: null, ...(wasActive ? { ownGatewayEnabled: false, ownGatewayProvider: null } : {}) },
  });

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: undefined };
}

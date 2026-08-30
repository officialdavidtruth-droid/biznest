import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const STORE_CUSTOMER_COOKIE = "bn-store-customer";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoreCustomerSession = {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: "CUSTOMER";
    customerStoreId: string;
  };
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return secret;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );

  return Buffer.from(signature).toString("base64url");
}

async function createToken(
  userId: string,
  storeId: string
): Promise<string> {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;

  const payload = `${userId}.${storeId}.${issuedAt}.${expiresAt}`;

  return `${payload}.${await hmac(payload)}`;
}

async function verifyToken(
  token: string | undefined
): Promise<{
  userId: string;
  storeId: string;
  issuedAt: number;
} | null> {
  if (!token) return null;

  const parts = token.split(".");

  if (parts.length !== 5) return null;

  const [
    userId,
    storeId,
    issuedAtRaw,
    expiresAtRaw,
    signature,
  ] = parts;

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);

  if (
    !userId ||
    !storeId ||
    !signature ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt)
  ) {
    return null;
  }

  const now = Date.now();

  if (now >= expiresAt) return null;

  if (issuedAt > now + 60_000) return null;

  const payload =
    `${userId}.${storeId}.${issuedAt}.${expiresAt}`;

  const expected = await hmac(payload);

  if (expected.length !== signature.length) {
    return null;
  }

  let diff = 0;

  for (let i = 0; i < expected.length; i++) {
    diff |=
      expected.charCodeAt(i) ^
      signature.charCodeAt(i);
  }

  if (diff !== 0) return null;

  return {
    userId,
    storeId,
    issuedAt,
  };
}

export async function getStoreCustomerSession(): Promise<
  StoreCustomerSession | null
> {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    STORE_CUSTOMER_COOKIE
  )?.value;

  const verified = await verifyToken(token);

  if (!verified) return null;

  const user = await prisma.user.findUnique({
    where: {
      id: verified.userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      customerScopeStoreId: true,
      isBanned: true,
      sessionsInvalidatedAt: true,
      storeMemberships: {
        where: {
          storeId: verified.storeId,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (
    !user ||
    user.role !== "CUSTOMER" ||
    user.isBanned ||
    user.customerScopeStoreId !== verified.storeId ||
    user.storeMemberships.length === 0 ||
    (user.sessionsInvalidatedAt &&
      user.sessionsInvalidatedAt.getTime() >
        verified.issuedAt)
  ) {
    return null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "CUSTOMER",
      customerStoreId: verified.storeId,
    },
  };
}

/**
 * Creates a store customer session.
 *
 * This is intentionally separate from the admin authentication
 * system and uses the bn-store-customer cookie only.
 */
export async function createStoreCustomerSession(
  userId: string,
  storeId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      customerScopeStoreId: true,
      isBanned: true,
      storeMemberships: {
        where: {
          storeId,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (
    !user ||
    user.role !== "CUSTOMER" ||
    user.isBanned ||
    user.customerScopeStoreId !== storeId ||
    user.storeMemberships.length === 0
  ) {
    throw new Error(
      "Invalid store customer account."
    );
  }

  const token = await createToken(
    user.id,
    storeId
  );

  const cookieStore = await cookies();

  cookieStore.set(
    STORE_CUSTOMER_COOKIE,
    token,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_TTL_MS / 1000,
    }
  );
}

/**
 * Deletes only the store customer session.
 *
 * This does NOT touch the admin authentication
 * cookie or any other authentication state.
 */
export async function deleteStoreCustomerSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(
    STORE_CUSTOMER_COOKIE,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }
  );
}

export async function signInStoreCustomer(
  storeSlug: string,
  email: string,
  password: string
): Promise<
  | {
      success: true;
      storeSlug: string;
    }
  | {
      success: false;
      code:
        | "INVALID_CREDENTIALS"
        | "ACCOUNT_LOCKED"
        | "ACCOUNT_BANNED"
        | "RATE_LIMITED"
        | "STORE_ACCOUNT_NOT_FOUND";
    }
> {
  // Rate-limit credential attempts before doing any DB/bcrypt work, mirroring
  // the platform Credentials provider in lib/auth.ts. Separate IP and
  // identifier buckets so an attacker can't dodge protection by rotating
  // just one dimension (e.g. hammering many customer accounts from one IP,
  // or one account from many IPs). Scoped per-store since the same email
  // can be an independent account on multiple stores.
  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);
  const ipLimit = await checkRateLimit(`store-login:ip:${clientIp}`, 20, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return { success: false, code: "RATE_LIMITED" };
  }
  const normalizedIdentifier = email.trim().toLowerCase();
  const identifierLimit = await checkRateLimit(
    `store-login:identifier:${storeSlug}:${normalizedIdentifier}`,
    10,
    15 * 60 * 1000
  );
  if (!identifierLimit.allowed) {
    return { success: false, code: "RATE_LIMITED" };
  }

  const store = await prisma.store.findUnique({
    where: {
      slug: storeSlug,
    },
    select: {
      id: true,
    },
  });

  if (!store) {
    return {
      success: false,
      code: "STORE_ACCOUNT_NOT_FOUND",
    };
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
      customerScopeStoreId: store.id,
      role: "CUSTOMER",
    },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isBanned: true,
      lockedUntil: true,
      failedLoginAttempts: true,
      storeMemberships: {
        where: {
          storeId: store.id,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (
    !user ||
    user.storeMemberships.length === 0
  ) {
    return {
      success: false,
      code: "STORE_ACCOUNT_NOT_FOUND",
    };
  }

  if (user.isBanned) {
    return {
      success: false,
      code: "ACCOUNT_BANNED",
    };
  }

  if (
    user.lockedUntil &&
    user.lockedUntil > new Date()
  ) {
    return {
      success: false,
      code: "ACCOUNT_LOCKED",
    };
  }

  if (!user.passwordHash) {
    return {
      success: false,
      code: "INVALID_CREDENTIALS",
    };
  }

  const valid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!valid) {
    const attempts =
      user.failedLoginAttempts + 1;

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginAttempts: attempts,

        ...(attempts >= 5
          ? {
              lockedUntil: new Date(
                Date.now() +
                  15 * 60 * 1000
              ),
              failedLoginAttempts: 0,
            }
          : {}),
      },
    });

    return {
      success: false,
      code:
        attempts >= 5
          ? "ACCOUNT_LOCKED"
          : "INVALID_CREDENTIALS",
    };
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await createStoreCustomerSession(
    user.id,
    store.id
  );

  return {
    success: true,
    storeSlug,
  };
}

export async function signOutStoreCustomer(): Promise<void> {
  await deleteStoreCustomerSession();
}

export async function getStoreCustomerSessionForStore(
  storeSlug: string
) {
  const session =
    await getStoreCustomerSession();

  if (!session) return null;

  const store =
    await prisma.store.findUnique({
      where: {
        slug: storeSlug,
      },
      select: {
        id: true,
      },
    });

  if (
    !store ||
    store.id !==
      session.user.customerStoreId
  ) {
    return null;
  }

  return session;
}
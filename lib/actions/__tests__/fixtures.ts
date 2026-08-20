import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";

/**
 * Test fixtures for the DB-backed integration tests in this directory.
 * These write real rows via the real Prisma client — see TESTING.md for
 * how to point DATABASE_URL at a disposable test database before running
 * `npm run test`. Never run these against production.
 *
 * Every fixture below is tagged with a random suffix so parallel test
 * files (and repeated local runs) never collide on unique columns
 * (Store.slug, User.email, etc), and cleanupTestStore() tears down
 * everything created for one store by id rather than relying on
 * onDelete: Cascade for models that don't have it wired up for Order
 * (Order.storeId/buyerId are plain FKs, not cascading — see schema).
 */

export type TestStoreFixture = {
  suffix: string;
  ownerUser: Awaited<ReturnType<typeof prisma.user.create>>;
  business: Awaited<ReturnType<typeof prisma.business.create>>;
  store: Awaited<ReturnType<typeof prisma.store.create>>;
};

export async function createTestStoreWithOwner(opts?: {
  commissionRate?: number;
}): Promise<TestStoreFixture> {
  const suffix = nanoid(8).toLowerCase();

  const ownerUser = await prisma.user.create({
    data: {
      email: `owner-${suffix}@test.biznest.internal`,
      name: "Test Owner",
      role: "STORE_OWNER",
    },
  });

  const business = await prisma.business.create({
    data: {
      userId: ownerUser.id,
      businessName: `Test Biz ${suffix}`,
      category: "Retail",
      description: "Fixture business for automated tests.",
      sellsProducts: true,
      offersServices: false,
      phone: "+2340000000000",
      email: ownerUser.email,
      country: "Nigeria",
      state: "Lagos",
      city: "Lagos",
      registrationType: "REGISTERED",
    },
  });

  let subscriptionId: string | undefined;
  if (opts?.commissionRate !== undefined) {
    const subscription = await prisma.subscription.create({
      data: {
        name: `Test Plan ${suffix}`,
        price: 0,
        interval: "MONTHLY",
        features: {},
        commissionRate: opts.commissionRate,
      },
    });
    subscriptionId = subscription.id;
  }

  const store = await prisma.store.create({
    data: {
      businessId: business.id,
      name: `Test Store ${suffix}`,
      slug: `test-store-${suffix}`,
      status: "ACTIVE",
      subscriptionId,
    },
  });

  return { suffix, ownerUser, business, store };
}

export async function createTestProduct(
  storeId: string,
  opts?: { price?: number; quantity?: number; hasVariants?: boolean }
) {
  const suffix = nanoid(6).toLowerCase();
  return prisma.product.create({
    data: {
      storeId,
      name: `Test Product ${suffix}`,
      slug: `test-product-${suffix}`,
      description: "Fixture product for automated tests.",
      price: opts?.price ?? 1000,
      hasVariants: opts?.hasVariants ?? false,
      inventory: opts?.hasVariants
        ? undefined
        : { create: { storeId, quantity: opts?.quantity ?? 10 } },
    },
    include: { inventory: true },
  });
}

export async function createTestVariant(
  productId: string,
  storeId: string,
  opts?: { price?: number; quantity?: number; label?: string }
) {
  const suffix = nanoid(6).toLowerCase();
  return prisma.productVariant.create({
    data: {
      productId,
      storeId,
      label: opts?.label ?? `Variant ${suffix}`,
      optionValues: { Size: suffix },
      price: opts?.price,
      quantity: opts?.quantity ?? 10,
    },
  });
}

/**
 * Deletes everything created for one test store, in FK-safe order.
 * Order/OrderItem/Payment/etc don't cascade from Store (see schema), so
 * they're deleted explicitly before the store itself; most product-side
 * tables do cascade from Store but are included here anyway to keep this
 * resilient if that ever changes.
 */
export async function cleanupTestStore(fixture: TestStoreFixture) {
  const storeId = fixture.store.id;

  await prisma.stockMovement.deleteMany({ where: { storeId } });
  await prisma.orderStatusEvent.deleteMany({ where: { order: { storeId } } });
  await prisma.payment.deleteMany({ where: { storeId } });
  await prisma.orderItem.deleteMany({ where: { order: { storeId } } });
  await prisma.order.deleteMany({ where: { storeId } });
  await prisma.posCommissionSettlement.deleteMany({ where: { storeId } });
  await prisma.productVariant.deleteMany({ where: { storeId } });
  await prisma.inventoryItem.deleteMany({ where: { storeId } });
  await prisma.product.deleteMany({ where: { storeId } });

  await prisma.store.delete({ where: { id: storeId } });
  await prisma.business.delete({ where: { id: fixture.business.id } });
  await prisma.user.delete({ where: { id: fixture.ownerUser.id } });

  // The POS walk-in customer (see getOrCreateWalkInCustomer in pos.ts) is
  // its own User row, not created via the Business/Store relations above.
  await prisma.user.deleteMany({
    where: { email: `pos-walkin-${storeId}@biznest.internal` },
  });

  if (fixture.store.subscriptionId) {
    await prisma.subscription.deleteMany({ where: { id: fixture.store.subscriptionId } });
  }
}

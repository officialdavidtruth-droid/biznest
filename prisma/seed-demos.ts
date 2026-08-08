/**
 * Seeds three real, permanent, ACTIVE demo storefronts — one per shipped
 * template — at fixed slugs (/store/demo-fresh, /store/demo-heenzy,
 * /store/demo-nova). Unlike the mini mockup previews in the dashboard
 * Template Gallery, these are the actual app running the actual template
 * code, with real catalog, reviews, and completed-order history, so a
 * visitor can click all the way through home → category → product → cart →
 * checkout before ever signing up.
 *
 * Run AFTER `npm run db:seed` (needs StoreTemplate + Category rows to exist).
 * Safe to re-run — upserts by fixed slug/email, does not duplicate data.
 *
 *   npx tsx prisma/seed-demos.ts
 *   (wired up as `npm run db:seed:demos`, see package.json)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { DEMO_STORES } from "../lib/demo-stores";
import { fetchDemoPhoto, fetchDemoPhotos } from "../lib/demo-images";

function slug(name: string): string {
  return slugify(name, { lower: true, strict: true });
}

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo-preview-only";

async function main() {
  for (const seed of DEMO_STORES) {
    const template = await prisma.storeTemplate.findUnique({ where: { name: seed.templateName } });
    if (!template) {
      console.warn(`Skipping ${seed.slug}: template "${seed.templateName}" not found — run "npm run db:seed" first.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const user = await prisma.user.upsert({
      where: { email: seed.ownerEmail },
      update: { name: seed.ownerName, emailVerified: new Date() },
      create: {
        email: seed.ownerEmail,
        name: seed.ownerName,
        passwordHash,
        emailVerified: new Date(),
        role: "CUSTOMER",
      },
    });

    const business = await prisma.business.upsert({
      where: { userId: user.id },
      update: {
        businessName: seed.storeName,
        category: seed.businessCategory,
        description: seed.description,
        verificationStatus: "APPROVED",
        verificationBadge: true,
      },
      create: {
        userId: user.id,
        businessName: seed.storeName,
        category: seed.businessCategory,
        description: seed.description,
        sellsProducts: true,
        offersServices: false,
        phone: seed.contactPhone,
        email: seed.contactEmail,
        country: seed.country,
        state: seed.state,
        city: seed.city,
        registrationType: "UNREGISTERED",
        verificationStatus: "APPROVED",
        verificationBadge: true,
        fraudPolicyAcceptedAt: new Date(),
      },
    });

    const [logoUrl, bannerUrl] = await Promise.all([
      fetchDemoPhoto(seed.logoQuery),
      fetchDemoPhoto(seed.bannerQuery),
    ]);

    const store = await prisma.store.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.storeName,
        templateId: template.id,
        status: "ACTIVE",
        logoUrl,
        bannerUrl,
        contactEmail: seed.contactEmail,
        contactPhone: seed.contactPhone,
      },
      create: {
        businessId: business.id,
        name: seed.storeName,
        slug: seed.slug,
        templateId: template.id,
        status: "ACTIVE",
        logoUrl,
        bannerUrl,
        contactEmail: seed.contactEmail,
        contactPhone: seed.contactPhone,
        socialLinks: { whatsapp: seed.contactPhone.replace("+", "") } as Prisma.InputJsonValue,
      },
    });

    // Products + images (fetched in parallel per store)
    const images = await fetchDemoPhotos(seed.products.map((p) => p.imageQuery));

    for (let i = 0; i < seed.products.length; i++) {
      const p = seed.products[i];
      const category = await prisma.category.findUnique({ where: { name: p.category } });
      const productSlug = slug(p.name);
      const image = images[i];

      await prisma.product.upsert({
        where: { storeId_slug: { storeId: store.id, slug: productSlug } },
        update: {
          name: p.name,
          description: p.description,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          images: image ? [image] : [],
          categoryId: category?.id,
          isPublished: true,
        },
        create: {
          storeId: store.id,
          categoryId: category?.id,
          type: "PHYSICAL",
          name: p.name,
          slug: productSlug,
          description: p.description,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          currency: "NGN",
          images: image ? [image] : [],
          isPublished: true,
          inventory: { create: { quantity: 50, lowStockThreshold: 5 } },
        },
      });
    }

    // A handful of completed orders + reviews, so the storefront's stats
    // (rating, "X+ orders fulfilled") and testimonial sections have real
    // data behind them instead of rendering empty.
    const products = await prisma.product.findMany({ where: { storeId: store.id } });

    for (let i = 0; i < seed.reviews.length; i++) {
      const r = seed.reviews[i];
      const reviewer = await prisma.user.upsert({
        where: { email: `${seed.slug}-reviewer-${i}@biznest.example` },
        update: {},
        create: {
          email: `${seed.slug}-reviewer-${i}@biznest.example`,
          name: r.authorName,
          role: "CUSTOMER",
          emailVerified: new Date(),
        },
      });
      const product = products[i % products.length];

      // Re-running the seed shouldn't pile up duplicate orders/reviews —
      // one order+review per reviewer per store is enough to seed stats.
      const existingOrder = await prisma.order.findFirst({ where: { storeId: store.id, buyerId: reviewer.id } });
      if (!existingOrder) {
        await prisma.order.create({
          data: {
            storeId: store.id,
            buyerId: reviewer.id,
            status: "COMPLETED",
            subtotal: product.price,
            commission: 0,
            total: product.price,
            currency: "NGN",
            items: { create: [{ productId: product.id, quantity: 1, unitPrice: product.price }] },
          },
        });
      }

      const existingReview = await prisma.review.findFirst({
        where: { storeId: store.id, authorId: reviewer.id, productId: product.id },
      });
      if (!existingReview) {
        await prisma.review.create({
          data: { storeId: store.id, productId: product.id, authorId: reviewer.id, rating: r.rating, comment: r.comment },
        });
      }
    }

    console.log(`Seeded demo store: /store/${seed.slug} (${seed.templateName})`);
  }

  console.log("Demo stores seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

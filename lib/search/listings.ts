import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ListingSearchParams {
  category: string;
  attributes?: Record<string, string | number>; // category-specific, e.g. { bedrooms: 3 }
  priceMin?: number;
  priceMax?: number;
  city?: string;
  state?: string;
}

/**
 * Searches Products with structured attribute filters (e.g. real estate
 * bedrooms/bathrooms, photography event type). Reads keys defined in
 * Category.filterSchema; unknown/absent keys are simply ignored by
 * whichever template renders the listing, same as Product.attributes today.
 */
export async function searchListings(params: ListingSearchParams) {
  const { category, attributes, priceMin, priceMax, city, state } = params;

  const attributeFilters: Prisma.ProductWhereInput[] = attributes
    ? Object.entries(attributes).map(([key, value]) => ({
        attributes: { path: [key], equals: value },
      }))
    : [];

  return prisma.product.findMany({
    where: {
      isPublished: true,
      category: { name: category },
      ...(priceMin && { price: { gte: priceMin } }),
      ...(priceMax && { price: { lte: priceMax } }),
      AND: attributeFilters,
      store: {
        business: {
          searchVisible: true,
          ...(city && { city: { equals: city, mode: "insensitive" } }),
          ...(state && { state: { equals: state, mode: "insensitive" } }),
        },
      },
    },
    include: {
      store: { include: { business: true } },
    },
    take: 40,
  });
}

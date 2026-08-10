import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface DiscoverySearchParams {
  q?: string; // free-text: "photographer", "plumber"
  category?: string;
  city?: string;
  state?: string;
  minRating?: number;
  minTrustScore?: number;
  verifiedOnly?: boolean;
  offersServices?: boolean;
  sellsProducts?: boolean;
  sort?: "relevance" | "rating" | "newest" | "trustScore";
  page?: number;
  pageSize?: number;
}

export async function searchBusinesses(params: DiscoverySearchParams) {
  const {
    q,
    category,
    city,
    state,
    minRating,
    minTrustScore,
    verifiedOnly,
    offersServices,
    sellsProducts,
    page = 1,
    pageSize = 20,
  } = params;

  const where: Prisma.BusinessWhereInput = {
    searchVisible: true,
    ...(verifiedOnly && { verificationStatus: "APPROVED", verificationBadge: true }),
    ...(category && { category }),
    ...(city && { city: { equals: city, mode: "insensitive" } }),
    ...(state && { state: { equals: state, mode: "insensitive" } }),
    ...(minRating && { avgRating: { gte: minRating } }),
    // trustScore is nullable (unscored businesses, e.g. brand new ones)
    // -- filtering "gte" naturally excludes nulls, which is the right
    // behavior for a minimum-score filter.
    ...(minTrustScore && { trustScore: { gte: minTrustScore } }),
    ...(offersServices !== undefined && { offersServices }),
    ...(sellsProducts !== undefined && { sellsProducts }),
    ...(q && {
      OR: [
        { businessName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [results, total] = await Promise.all([
    prisma.business.findMany({
      where,
      include: {
        store: {
          select: {
            slug: true,
            name: true,
            logoUrl: true,
            bannerUrl: true,
            products: { take: 3, where: { isPublished: true } },
            services: { take: 3, where: { isPublished: true } },
          },
        },
      },
      orderBy: resolveSort(params.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.business.count({ where }),
  ]);

  return { results, total, page, pageSize };
}

function resolveSort(sort?: DiscoverySearchParams["sort"]) {
  switch (sort) {
    case "rating":
      return { avgRating: "desc" as const };
    case "trustScore":
      // Reads the persisted column (see Business.trustScore in
      // schema.prisma) -- sorting off a live per-row computation isn't
      // viable for a paginated list. nulls "last" so not-yet-scored
      // businesses (no orders/reviews yet) don't crowd out the top of
      // the results.
      return { trustScore: { sort: "desc" as const, nulls: "last" as const } };
    case "newest":
      return { createdAt: "desc" as const };
    default:
      // "relevance" default: verified businesses surface first.
      return { verificationBadge: "desc" as const };
  }
}

/**
 * Distance-based search using Postgres haversine math. Raw SQL because
 * Prisma's query builder can't express great-circle distance filtering.
 */
export async function searchNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  category?: string
) {
  return prisma.$queryRaw`
    SELECT *,
      ( 6371 * acos(
          cos(radians(${lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(latitude))
        )
      ) AS distance_km
    FROM "Business"
    WHERE "searchVisible" = true
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
    HAVING ( 6371 * acos(
          cos(radians(${lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(latitude))
        ) ) <= ${radiusKm}
    ORDER BY distance_km ASC
    LIMIT 50;
  `;
}

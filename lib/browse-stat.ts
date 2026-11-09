import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** The Lagos calendar day (UTC+1, no daylight saving) as yyyy-mm-dd. */
export const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

/** Adds `by` to one day's counter for a store (and optionally a post). One upsert, never one row per event. */
export async function bumpBrowseStat(storeId: string, kind: string, postId: string, by: number) {
  const day = lagosToday();
  await prisma.$executeRaw`
    INSERT INTO "BrowseStat" ("id", "storeId", "day", "kind", "postId", "count")
    VALUES (${randomUUID()}, ${storeId}, ${day}::date, ${kind}, ${postId}, ${by})
    ON CONFLICT ("storeId", "day", "kind", "postId")
    DO UPDATE SET "count" = "BrowseStat"."count" + ${by}`;
}

-- Persisted Trust Score for marketplace search sort/filter. The dashboard
-- keeps computing the full live breakdown on read (lib/actions/trust-score.ts
-- getTrustScoreBreakdown) -- that's unchanged and still the source of truth
-- for factor-level detail. This column is a denormalized copy of just the
-- final 0-100 number, kept in sync by recomputeAndPersistTrustScore() at the
-- write paths that can move it (order status change, dispute resolution,
-- verification decisions) plus a nightly sweep for the slower-moving factors
-- (account age, response time drift). Nullable/additive, same pattern as
-- Business.avgRating.

ALTER TABLE "Business" ADD COLUMN "trustScore" INTEGER;
ALTER TABLE "Business" ADD COLUMN "trustScoreUpdatedAt" TIMESTAMP(3);

CREATE INDEX "Business_trustScore_idx" ON "Business"("trustScore");

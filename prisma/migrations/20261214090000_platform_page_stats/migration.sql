-- CreateTable
CREATE TABLE "PlatformPageStat" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "signedInViews" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlatformPageStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPageStat_day_path_key" ON "PlatformPageStat"("day", "path");

-- CreateIndex
CREATE INDEX "PlatformPageStat_day_idx" ON "PlatformPageStat"("day");

-- Per-job switch for showing the salary range on the public careers page. Off by default. Additive only.
ALTER TABLE "RecruitJob" ADD COLUMN "showSalary" BOOLEAN NOT NULL DEFAULT false;

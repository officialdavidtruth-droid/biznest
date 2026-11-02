-- Link a hired application to the HR & Payroll employee record created for it. Additive only.
ALTER TABLE "RecruitApplication" ADD COLUMN "hrEmployeeId" TEXT;
CREATE INDEX "RecruitApplication_hrEmployeeId_idx" ON "RecruitApplication"("hrEmployeeId");
ALTER TABLE "RecruitApplication" ADD CONSTRAINT "RecruitApplication_hrEmployeeId_fkey" FOREIGN KEY ("hrEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

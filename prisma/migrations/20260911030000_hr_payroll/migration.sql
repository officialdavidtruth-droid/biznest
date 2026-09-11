CREATE TYPE "HrEmployeeStatus" AS ENUM ('ACTIVE','ON_LEAVE','SUSPENDED','EXITED');
CREATE TYPE "HrEmploymentType" AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','INTERN','TEMPORARY');
CREATE TYPE "HrAttendanceStatus" AS ENUM ('PRESENT','ABSENT','LATE','HALF_DAY','ON_LEAVE');
CREATE TYPE "HrLeaveStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
CREATE TYPE "HrPayrollStatus" AS ENUM ('DRAFT','APPROVED','PAID','VOID');

CREATE TABLE "HrEmployee" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "staffId" TEXT,
  "employeeNo" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "department" TEXT,
  "position" TEXT,
  "employmentType" "HrEmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  "status" "HrEmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "hireDate" DATE,
  "exitDate" DATE,
  "basicSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "housingAllowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "transportAllowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "otherAllowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "bankName" TEXT,
  "accountName" TEXT,
  "accountNumber" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployee_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HrAttendance" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "status" "HrAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "checkIn" TIMESTAMP(3),
  "checkOut" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrAttendance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HrLeaveRequest" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveType" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "reason" TEXT,
  "status" "HrLeaveStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLeaveRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HrPayrollRun" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "payDate" DATE,
  "status" "HrPayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrPayrollRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HrPayrollItem" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "basic" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "allowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "net" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  CONSTRAINT "HrPayrollItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrEmployee_staffId_key" ON "HrEmployee"("staffId");
CREATE UNIQUE INDEX "HrEmployee_storeId_employeeNo_key" ON "HrEmployee"("storeId","employeeNo");
CREATE UNIQUE INDEX "HrAttendance_employeeId_workDate_key" ON "HrAttendance"("employeeId","workDate");
CREATE UNIQUE INDEX "HrPayrollItem_payrollRunId_employeeId_key" ON "HrPayrollItem"("payrollRunId","employeeId");
CREATE INDEX "HrEmployee_storeId_status_idx" ON "HrEmployee"("storeId","status");
CREATE INDEX "HrEmployee_storeId_department_idx" ON "HrEmployee"("storeId","department");
CREATE INDEX "HrAttendance_storeId_workDate_idx" ON "HrAttendance"("storeId","workDate");
CREATE INDEX "HrAttendance_employeeId_workDate_idx" ON "HrAttendance"("employeeId","workDate");
CREATE INDEX "HrLeaveRequest_storeId_status_startDate_idx" ON "HrLeaveRequest"("storeId","status","startDate");
CREATE INDEX "HrLeaveRequest_employeeId_startDate_endDate_idx" ON "HrLeaveRequest"("employeeId","startDate","endDate");
CREATE INDEX "HrPayrollRun_storeId_periodStart_periodEnd_idx" ON "HrPayrollRun"("storeId","periodStart","periodEnd");
CREATE INDEX "HrPayrollRun_storeId_status_idx" ON "HrPayrollRun"("storeId","status");
CREATE INDEX "HrPayrollItem_employeeId_idx" ON "HrPayrollItem"("employeeId");
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StoreStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrAttendance" ADD CONSTRAINT "HrAttendance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrAttendance" ADD CONSTRAINT "HrAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrPayrollRun" ADD CONSTRAINT "HrPayrollRun_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItem" ADD CONSTRAINT "HrPayrollItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "HrPayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItem" ADD CONSTRAINT "HrPayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

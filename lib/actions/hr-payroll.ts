"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/actions/activity";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  const a = await assertStorePermission(slug, "hr");
  if (!a.success) return { ok: false as const, error: a.error };
  const e = await prisma.storePlugin.findFirst({ where: { storeId: a.store.id, plugin: { key: "hr-payroll" }, status: "ACTIVE" } });
  if (!e) return { ok: false as const, error: "Install HR & Payroll to use this workspace." };
  return { ok: true as const, store: a.store };
}

const money = (v: unknown) => Number(v ?? 0);

export async function getHrDashboard(slug: string) {
  const a = await access(slug);
  if (!a.ok) return { error: a.error };
  const storeId = a.store.id;
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const [employees, present, pendingLeave, latestRun, attendance, departments] = await Promise.all([
    prisma.hrEmployee.count({ where: { storeId, status: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrAttendance.count({ where: { storeId, workDate: { gte: today, lt: tomorrow }, status: { in: ["PRESENT", "LATE", "HALF_DAY"] } } }),
    prisma.hrLeaveRequest.count({ where: { storeId, status: "PENDING" } }),
    prisma.hrPayrollRun.findFirst({ where: { storeId }, orderBy: { periodEnd: "desc" }, select: { id:true, periodStart:true, periodEnd:true, status:true, totalGross:true, totalDeductions:true, totalNet:true } }),
    prisma.hrAttendance.findMany({ where: { storeId, workDate: { gte: today, lt: tomorrow } }, include: { employee: { select: { id:true,firstName:true,lastName:true,employeeNo:true,department:true } } }, orderBy: { employee: { firstName: "asc" } }, take: 50 }),
    prisma.hrEmployee.findMany({ where: { storeId, status: { in: ["ACTIVE","ON_LEAVE"] } }, select: { department:true }, distinct:["department"] }),
  ]);
  return { employees, present, pendingLeave, latestRun: latestRun ? {...latestRun, totalGross:money(latestRun.totalGross), totalDeductions:money(latestRun.totalDeductions), totalNet:money(latestRun.totalNet)} : null, attendance, departments: departments.map(x=>x.department).filter(Boolean) };
}

export async function createHrEmployee(slug: string, form: FormData): Promise<ActionResult<{id:string}>> {
  const a = await access(slug); if (!a.ok) return {success:false,error:a.error};
  const firstName=String(form.get("firstName")||"").trim(), lastName=String(form.get("lastName")||"").trim();
  const employeeNo=String(form.get("employeeNo")||"").trim().toUpperCase();
  if(!firstName||!lastName||!employeeNo) return {success:false,error:"First name, last name and employee number are required."};
  const basic=Number(form.get("basicSalary")||0), housing=Number(form.get("housingAllowance")||0), transport=Number(form.get("transportAllowance")||0), other=Number(form.get("otherAllowance")||0);
  if([basic,housing,transport,other].some(x=>!Number.isFinite(x)||x<0)) return {success:false,error:"Salary values must be valid non-negative amounts."};
  try {
    const employee=await prisma.hrEmployee.create({data:{storeId:a.store.id,employeeNo,firstName,lastName,email:String(form.get("email")||"").trim()||null,phone:String(form.get("phone")||"").trim()||null,department:String(form.get("department")||"").trim()||null,position:String(form.get("position")||"").trim()||null,employmentType:(String(form.get("employmentType")||"FULL_TIME") as any),hireDate:form.get("hireDate")?new Date(String(form.get("hireDate"))):null,basicSalary:basic,housingAllowance:housing,transportAllowance:transport,otherAllowance:other,bankName:String(form.get("bankName")||"").trim()||null,accountName:String(form.get("accountName")||"").trim()||null,accountNumber:String(form.get("accountNumber")||"").trim()||null}});
    const s=await auth(); await logStoreActivity({storeId:a.store.id,actor:{id:s?.user?.id,name:s?.user?.name,email:s?.user?.email,role:s?.user?.role},action:"hr.employee_created",target:employee.employeeNo});
    return {success:true,data:{id:employee.id}};
  } catch { return {success:false,error:"Employee number already exists or the employee could not be created."}; }
}

export async function recordHrAttendance(slug:string, employeeId:string, status:string):Promise<ActionResult<void>>{
  const a=await access(slug); if(!a.ok)return{success:false,error:a.error};
  const employee=await prisma.hrEmployee.findFirst({where:{id:employeeId,storeId:a.store.id,status:{in:["ACTIVE","ON_LEAVE"]}}}); if(!employee)return{success:false,error:"Employee not found."};
  const workDate=new Date(); workDate.setHours(0,0,0,0);
  const allowed=["PRESENT","ABSENT","LATE","HALF_DAY","ON_LEAVE"];
  if(!allowed.includes(status))return{success:false,error:"Invalid attendance status."};
  await prisma.hrAttendance.upsert({where:{employeeId_workDate:{employeeId,workDate}},create:{storeId:a.store.id,employeeId,workDate,status:status as any,checkIn:status!=="ABSENT"?new Date():null},update:{status:status as any,checkIn:status!=="ABSENT"?new Date():null}});
  return {success:true,data:undefined};
}

export async function requestHrLeave(slug:string, employeeId:string, leaveType:string, startDate:string, endDate:string, reason?:string):Promise<ActionResult<void>>{
  const a=await access(slug); if(!a.ok)return{success:false,error:a.error};
  const start=new Date(startDate), end=new Date(endDate); if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return{success:false,error:"Enter a valid leave period."};
  const employee=await prisma.hrEmployee.findFirst({where:{id:employeeId,storeId:a.store.id}}); if(!employee)return{success:false,error:"Employee not found."};
  const overlap=await prisma.hrLeaveRequest.findFirst({where:{employeeId,status:{in:["PENDING","APPROVED"]},startDate:{lte:end},endDate:{gte:start}}}); if(overlap)return{success:false,error:"This employee already has an overlapping leave request."};
  await prisma.hrLeaveRequest.create({data:{storeId:a.store.id,employeeId,leaveType:leaveType.trim()||"Annual",startDate:start,endDate:end,reason:reason?.trim()||null}});
  return {success:true,data:undefined};
}

export async function decideHrLeave(slug:string,id:string,status:"APPROVED"|"REJECTED",note?:string):Promise<ActionResult<void>>{
  const a=await access(slug); if(!a.ok)return{success:false,error:a.error};
  const row=await prisma.hrLeaveRequest.findFirst({where:{id,storeId:a.store.id,status:"PENDING"}}); if(!row)return{success:false,error:"Leave request not found or already decided."};
  await prisma.$transaction(async tx=>{
    await tx.hrLeaveRequest.update({where:{id},data:{status,decisionNote:note?.trim()||null,decidedAt:new Date()}});
    if(status==="APPROVED") await tx.hrEmployee.update({where:{id:row.employeeId},data:{status:"ON_LEAVE"}});
  });
  return {success:true,data:undefined};
}

export async function createHrPayrollRun(slug:string, periodStart:string, periodEnd:string):Promise<ActionResult<{id:string}>>{
  const a=await access(slug); if(!a.ok)return{success:false,error:a.error};
  const start=new Date(periodStart),end=new Date(periodEnd); if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return{success:false,error:"Enter a valid payroll period."};
  const employees=await prisma.hrEmployee.findMany({where:{storeId:a.store.id,status:{in:["ACTIVE","ON_LEAVE"]}},select:{id:true,basicSalary:true,housingAllowance:true,transportAllowance:true,otherAllowance:true}});
  if(!employees.length)return{success:false,error:"Add active employees before running payroll."};
  const run=await prisma.$transaction(async tx=>{
    const created=await tx.hrPayrollRun.create({data:{storeId:a.store.id,periodStart:start,periodEnd:end}});
    let gross=0,deductions=0,net=0;
    for(const e of employees){const basic=money(e.basicSalary), allowances=money(e.housingAllowance)+money(e.transportAllowance)+money(e.otherAllowance), g=basic+allowances, n=g; gross+=g;net+=n; await tx.hrPayrollItem.create({data:{payrollRunId:created.id,employeeId:e.id,basic,allowances,deductions:0,gross:g,net:n}});}
    return tx.hrPayrollRun.update({where:{id:created.id},data:{totalGross:gross,totalDeductions:deductions,totalNet:net}});
  });
  return {success:true,data:{id:run.id}};
}
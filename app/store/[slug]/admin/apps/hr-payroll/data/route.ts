import { NextResponse } from "next/server";
import { getHrDashboard } from "@/lib/actions/hr-payroll";
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;const data=await getHrDashboard(slug);return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});}

import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";

/** True when the caller holds a live SupaAdmin PIN session. */
export async function isPlatformStaff(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSession(token);
}

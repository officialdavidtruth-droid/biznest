import { NextResponse } from "next/server";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { TRAVEL_BUSINESS_TYPE, TRAVEL_PLUGIN_KEY } from "@/lib/travel";

/** Same gate as the travel workspace, for API routes: signed in, permitted, app installed, travel business. */
export async function travelRouteAccess(slug: string) {
  const a = await assertStorePermission(slug, `plugin:${TRAVEL_PLUGIN_KEY}`);
  if (!a.success) return { ok: false as const, res: NextResponse.json({ error: a.error }, { status: a.error === "You must be signed in." ? 401 : 403 }) };
  const ent = await getPluginEntitlement(a.store.id, TRAVEL_PLUGIN_KEY);
  if (!ent.allowed || !ent.installed) return { ok: false as const, res: NextResponse.json({ error: "BizNest Travel is not available for this store." }, { status: 403 }) };
  const type = getCanonicalBusinessType({ businessCategory: a.store.business?.category, storeBusinessType: a.store.businessType });
  if (type !== TRAVEL_BUSINESS_TYPE) return { ok: false as const, res: NextResponse.json({ error: "BizNest Travel is not available for this store." }, { status: 403 }) };
  return { ok: true as const, store: a.store };
}

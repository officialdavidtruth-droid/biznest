/**
 * The checklist of dashboard areas shown when inviting a staff member, and
 * stored on `StoreStaff.permissions` so the owner (and the invited person,
 * on the accept screen) can see exactly what access was granted.
 *
 * This list is currently informational/display-only — actual page access
 * is still gated by `role` (MANAGER/STAFF) via lib/access/store-access.ts.
 * If a specific dashboard route needs to be restricted further, check
 * `staff.permissions.includes(id)` there in addition to the role check.
 */
export const STAFF_PERMISSIONS = [
  { id: "products", label: "Products & inventory" },
  { id: "orders", label: "Orders" },
  { id: "customers", label: "Customer list" },
  { id: "messages", label: "Customer messages" },
  { id: "marketing", label: "Marketing & coupons" },
  { id: "analytics", label: "Analytics & reports" },
  { id: "payments", label: "Payments & payouts" },
  { id: "settings", label: "Store settings" },
] as const;

export type StaffPermissionId = (typeof STAFF_PERMISSIONS)[number]["id"];

export const STAFF_PERMISSION_IDS = STAFF_PERMISSIONS.map((p) => p.id) as StaffPermissionId[];

export function labelForPermission(id: string): string {
  return STAFF_PERMISSIONS.find((p) => p.id === id)?.label ?? id;
}

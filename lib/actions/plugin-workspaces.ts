"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";

export async function getPluginWorkspace(slug: string, pluginKey: string) {
  const access = await assertStorePermission(slug, "products");
  if (!access.success) return { error: access.error };
  const entitlement = await getPluginEntitlement(access.store.id, pluginKey);
  if (!entitlement.allowed || !entitlement.installed) return { error: entitlement.reason ?? "Install this app first." };

  const storeId = access.store.id;
  const [leads, staff, suppliers, purchaseOrders, documents, approvals, assets, vehicles, orders, conversations] = await Promise.all([
    prisma.crmLead.count({ where: { storeId } }),
    prisma.storeStaff.count({ where: { storeId, status: "ACTIVE" } }),
    prisma.supplier.count({ where: { storeId, isArchived: false } }),
    prisma.purchaseOrder.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, poNumber: true, status: true, subtotal: true, currency: true, supplier: { select: { name: true } } } }),
    prisma.businessDocument.count({ where: { storeId } }),
    prisma.approvalRequest.count({ where: { storeId, status: "PENDING" } }),
    prisma.financialAsset.count({ where: { storeId, status: "ACTIVE" } }),
    prisma.autoVehicle.count({ where: { storeId } }),
    prisma.order.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, total: true, currency: true, status: true, createdAt: true } }),
    prisma.conversation.count({ where: { storeId } }),
  ]);

  const config: Record<string, { subtitle: string; actions: Array<{ label: string; href: string }> }> = {
    crm: { subtitle: "Manage pipeline, customer relationships, follow-ups and sales activity.", actions: [{ label: "Leads", href: "/customers" }, { label: "Quotes", href: "/quotes" }, { label: "Customers", href: "/customers" }] },
    "hr-payroll": { subtitle: "Manage workforce records, staffing operations and people workflows.", actions: [{ label: "Staff", href: "/staff" }, { label: "Activity", href: "/activity" }] },
    procurement: { subtitle: "Control suppliers, purchasing, approvals and receiving from request to delivery.", actions: [{ label: "Purchase orders", href: "/purchase-orders" }, { label: "Suppliers", href: "/suppliers" }, { label: "Requisitions", href: "/apps/requisition" }] },
    "advanced-analytics": { subtitle: "Turn operational data into management signals and decisions.", actions: [{ label: "Analytics", href: "/analytics" }, { label: "Orders", href: "/orders" }, { label: "Inventory", href: "/inventory" }] },
    helpdesk: { subtitle: "Track customer conversations, service load and unresolved support work.", actions: [{ label: "Messages", href: "/messages" }, { label: "Customers", href: "/customers" }] },
    "asset-management": { subtitle: "Track business assets, capital equipment and lifecycle value.", actions: [{ label: "Financial assets", href: "/apps/financial-control" }, { label: "Documents", href: "/activity" }] },
    "legal-compliance": { subtitle: "Keep contracts, compliance documents, approvals and expiry risks visible.", actions: [{ label: "Documents", href: "/activity" }, { label: "Approvals", href: "/apps/requisition" }] },
    "fleet-management": { subtitle: "Control vehicles, operating records, service workload and fleet costs.", actions: [{ label: "Vehicles", href: "/apps/fleet-management" }, { label: "Expenses", href: "/apps/financial-control" }] },
    "loyalty-rewards": { subtitle: "Grow retention with customer loyalty, rewards and repeat-purchase signals.", actions: [{ label: "Customers", href: "/customers" }, { label: "Marketing", href: "/marketing" }] },
  };

  const c = config[pluginKey] ?? { subtitle: entitlement.plugin.description, actions: [{ label: "Analytics", href: "/analytics" }, { label: "Customers", href: "/customers" }, { label: "Settings", href: "/settings" }] };
  return {
    plugin: { key: entitlement.plugin.key, name: entitlement.plugin.name, category: entitlement.plugin.category, description: c.subtitle },
    metrics: { leads, staff, suppliers, purchaseOrders: purchaseOrders.length, documents, pendingApprovals: approvals, assets, vehicles, conversations },
    purchaseOrders: purchaseOrders.map((x) => ({ ...x, subtotal: Number(x.subtotal) })),
    orders: orders.map((x) => ({ ...x, total: Number(x.total), createdAt: x.createdAt.toISOString() })),
    actions: c.actions,
  };
}

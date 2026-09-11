"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";

const PAID = { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as any };

export async function getPluginWorkspace(slug: string, pluginKey: string) {
  const access = await assertStorePermission(slug, `plugin:${pluginKey}`);
  if (!access.success) return { error: access.error };
  const entitlement = await getPluginEntitlement(access.store.id, pluginKey);
  if (!entitlement.allowed || !entitlement.installed) return { error: entitlement.reason ?? "Install this app first." };

  const storeId = access.store.id;
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (pluginKey === "procurement") {
    const [
      suppliers,
      activeSuppliers,
      openPOs,
      pendingFinancialApprovals,
      requisitions,
      purchaseOrders,
      spend,
    ] = await Promise.all([
      prisma.supplier.count({ where: { storeId, isArchived: false } }),
      prisma.supplier.count({ where: { storeId, isArchived: false, purchaseOrders: { some: {} } } }),
      prisma.purchaseOrder.count({ where: { storeId, status: { in: ["DRAFT", "SENT", "PARTIALLY_RECEIVED"] } } }),
      prisma.approvalRequest.count({ where: { storeId, status: "PENDING", requestType: "REQUISITION", entityType: "Requisition" } }),
      prisma.requisition.findMany({
        where: { storeId, status: { in: ["SUBMITTED", "APPROVED"] } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 8,
        include: { items: { select: { quantity: true, estimatedUnitCost: true } } },
      }),
      prisma.purchaseOrder.findMany({
        where: { storeId, status: { in: ["SENT", "PARTIALLY_RECEIVED"] } },
        orderBy: [{ expectedAt: "asc" }, { createdAt: "desc" }],
        take: 8,
        include: { supplier: { select: { name: true } }, items: { select: { quantityOrdered: true, quantityReceived: true } } },
      }),
      prisma.purchaseOrder.aggregate({ where: { storeId, createdAt: { gte: since30 }, status: { not: "CANCELLED" } }, _sum: { subtotal: true } }),
    ]);

    const supplierRows = await prisma.supplier.findMany({
      where: { storeId, isArchived: false },
      orderBy: { name: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        purchaseOrders: { select: { id: true, status: true, subtotal: true, expectedAt: true, receivedAt: true } },
      },
    });
    const now = new Date();
    const awaitingReceiving = purchaseOrders.length;
    const overdueDeliveries = purchaseOrders.filter(p => p.expectedAt && p.expectedAt < now).length;

    return {
      plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Run purchasing from supplier discovery through requisition, financial approval, purchase order and receiving." },
      special: {
        kind: "procurement",
        summary: { suppliers, activeSuppliers, openPOs, pendingFinancialApprovals, requisitions: requisitions.length, awaitingReceiving, spend30: Number(spend._sum.subtotal ?? 0), overdueDeliveries },
        requisitions: requisitions.map(r => ({ id: r.id, number: r.number, title: r.title, department: r.department, requesterName: r.requesterName, priority: r.priority, status: r.status, neededBy: r.neededBy?.toISOString() ?? null, estimate: r.items.reduce((sum, i) => sum + Number(i.estimatedUnitCost ?? 0) * i.quantity, 0) })),
        purchaseOrders: purchaseOrders.map(p => ({ id: p.id, poNumber: p.poNumber, supplier: p.supplier.name, status: p.status, subtotal: Number(p.subtotal), currency: p.currency, expectedAt: p.expectedAt?.toISOString() ?? null, orderedUnits: p.items.reduce((n, i) => n + i.quantityOrdered, 0), receivedUnits: p.items.reduce((n, i) => n + i.quantityReceived, 0) })),
        suppliers: supplierRows.map(s => {
          const orders = s.purchaseOrders;
          const delivered = orders.filter(o => o.status === "RECEIVED" && o.receivedAt);
          const onTime = delivered.filter(o => !o.expectedAt || o.receivedAt! <= o.expectedAt).length;
          return { id: s.id, name: s.name, orders: orders.length, spend: orders.reduce((n, o) => n + Number(o.subtotal), 0), openOrders: orders.filter(o => ["DRAFT", "SENT", "PARTIALLY_RECEIVED"].includes(o.status)).length, onTimeRate: delivered.length ? Math.round(onTime / delivered.length * 100) : null };
        }),
      },
    };
  }

  if (pluginKey === "advanced-analytics") {
    const [orders, revenue, customers, visitors, lowStock, top] = await Promise.all([
      prisma.order.count({ where: { storeId, status: PAID, createdAt: { gte: since30 } } }),
      prisma.order.aggregate({ where: { storeId, status: PAID, createdAt: { gte: since30 } }, _sum: { total: true } }),
      prisma.storeCustomer.count({ where: { storeId, createdAt: { gte: since30 } } }),
      prisma.storeVisit.count({ where: { storeId, createdAt: { gte: since30 } } }),
      prisma.product.count({ where: { storeId, isPublished: true, inventory: { quantity: { lte: 5 } } } }),
      prisma.orderItem.groupBy({ by: ["productId"], where: { productId: { not: null }, order: { storeId, status: PAID, createdAt: { gte: since30 } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    ]);
    const topIds = top.map(x => x.productId).filter(Boolean) as string[];
    const products = topIds.length ? await prisma.product.findMany({ where: { id: { in: topIds }, storeId }, select: { id: true, name: true } }) : [];
    const names = new Map(products.map(p => [p.id, p.name]));
    const revenue30 = Number(revenue._sum.total ?? 0);
    return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Measure revenue, demand, customer growth, conversion and operational risk with decision-ready business intelligence." },
      special: { kind: "analytics", orders, revenue30, customers, visitors, lowStock, aov: orders ? revenue30 / orders : 0, top: top.map(x => ({ name: names.get(x.productId ?? "") ?? "Product", units: x._sum.quantity ?? 0 })) } };
  }

  if (pluginKey === "helpdesk") {
    const [conversations, unread, customers, recent] = await Promise.all([
      prisma.conversation.count({ where: { storeId } }),
      prisma.message.count({ where: { conversation: { storeId }, readAt: null } }),
      prisma.storeCustomer.count({ where: { storeId } }),
      prisma.conversation.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, createdAt: true, order: { select: { id: true, total: true, currency: true, status: true } } } }),
    ]);
    return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Operate a support inbox with customer context, conversations and follow-up queues." },
      special: { kind: "helpdesk", conversations, unread, customers, recent: recent.map(x => ({ id: x.id, createdAt: x.createdAt.toISOString(), order: x.order ? { ...x.order, total: Number(x.order.total) } : null })) } };
  }

  if (pluginKey === "asset-management") {
    const [assets, active, totalCost, recent] = await Promise.all([
      prisma.financialAsset.count({ where: { storeId } }),
      prisma.financialAsset.count({ where: { storeId, status: "ACTIVE" } }),
      prisma.financialAsset.aggregate({ where: { storeId, status: "ACTIVE" }, _sum: { purchaseCost: true } }),
      prisma.financialAsset.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, assetNo: true, name: true, category: true, purchaseCost: true, status: true, purchaseDate: true } }),
    ]);
    return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Maintain an asset register, capital value, depreciation profile and lifecycle controls." },
      special: { kind: "assets", assets, active, totalCost: Number(totalCost._sum.purchaseCost ?? 0), recent: recent.map(x => ({ ...x, purchaseCost: Number(x.purchaseCost), purchaseDate: x.purchaseDate.toISOString() })) } };
  }

  if (pluginKey === "legal-compliance") {
    const [documents, expiring, expired, approvals, recent] = await Promise.all([
      prisma.businessDocument.count({ where: { storeId } }),
      prisma.businessDocument.count({ where: { storeId, expiresAt: { gt: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.businessDocument.count({ where: { storeId, expiresAt: { lt: new Date() } } }),
      prisma.approvalRequest.count({ where: { storeId, status: "PENDING" } }),
      prisma.businessDocument.findMany({ where: { storeId }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, title: true, documentType: true, expiresAt: true, updatedAt: true } }),
    ]);
    return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Control contracts, statutory documents, expiry risk and approval obligations before they become business problems." },
      special: { kind: "legal", documents, expiring, expired, approvals, recent: recent.map(x => ({ ...x, expiresAt: x.expiresAt?.toISOString() ?? null, updatedAt: x.updatedAt.toISOString() })) } };
  }

  if (pluginKey === "fleet-management") {
    const [vehicles, recent, expenses] = await Promise.all([
      prisma.autoVehicle.count({ where: { storeId } }),
      prisma.autoVehicle.findMany({ where: { storeId }, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, registration: true, make: true, model: true, year: true, mileage: true, customerName: true, updatedAt: true } }),
      prisma.financialExpense.aggregate({ where: { storeId, expenseDate: { gte: since30 }, description: { contains: "fuel", mode: "insensitive" } }, _sum: { amount: true } }),
    ]);
    return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Manage vehicles, mileage, fuel spend and operating records from one fleet control room." },
      special: { kind: "fleet", vehicles, fuelSpend30: Number(expenses._sum.amount ?? 0), recent: recent.map(x => ({ ...x, updatedAt: x.updatedAt.toISOString() })) } };
  }

  if (pluginKey === "loyalty-rewards") {
    const [accounts, points, earned, redeemed] = await Promise.all([
      prisma.storeLoyaltyAccount.count({ where: { storeId } }),
      prisma.storeLoyaltyAccount.aggregate({ where: { storeId }, _sum: { pointsBalance: true } }),
      prisma.storeLoyaltyEntry.aggregate({ where: { loyaltyAccount: { storeId }, type: "EARN", createdAt: { gte: since30 } }, _sum: { points: true } }),
      prisma.storeLoyaltyEntry.aggregate({ where: { loyaltyAccount: { storeId }, type: "REDEEM", createdAt: { gte: since30 } }, _sum: { points: true } }),
    ]);
    return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Build retention with customer points, redemption activity and repeat-purchase signals." },
      special: { kind: "loyalty", accounts, balance: points._sum.pointsBalance ?? 0, earned30: earned._sum.points ?? 0, redeemed30: Math.abs(redeemed._sum.points ?? 0) } };
  }

  // HR gets a useful workforce control center even on installations that have
  // not yet applied the optional HR schema migration.
  if (pluginKey === "hr-payroll") {
    const [activeStaff, pendingInvites, admins, recent] = await Promise.all([
      prisma.storeStaff.count({ where: { storeId, status: "ACTIVE" } }),
      prisma.storeStaff.count({ where: { storeId, status: "PENDING" } }),
      prisma.storeStaff.count({ where: { storeId, role: "MANAGER" } }),
      prisma.storeStaff.findMany({ where: { storeId }, orderBy: { invitedAt: "desc" }, take: 8, select: { id: true, invitedName: true, invitedEmail: true, position: true, role: true, status: true } }),
    ]);
    return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: "Run workforce administration with staff records, access control, onboarding and payroll-ready employee data." },
      special: { kind: "hr", activeStaff, pendingInvites, admins, recent } };
  }

  // Unknown/legacy plugin: keep a safe fallback, but never present it as a
  // one-size-fits-all operational product in the UI.
  const [orders, customers, products] = await Promise.all([
    prisma.order.count({ where: { storeId, createdAt: { gte: since7 } } }),
    prisma.storeCustomer.count({ where: { storeId } }),
    prisma.product.count({ where: { storeId } }),
  ]);
  return { plugin: { key: pluginKey, name: entitlement.plugin.name, category: entitlement.plugin.category, description: entitlement.plugin.description }, special: { kind: "fallback", orders, customers, products } };
}
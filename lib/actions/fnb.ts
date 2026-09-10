"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";

export async function getFnbDashboard(slug: string) {
  const access = await assertStorePermission(slug, "products");
  if (!access.success) return null;
  const storeId = access.store.id;
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate()+1);

  const [orders, reservations, inventory, menuItems] = await Promise.all([
    prisma.order.findMany({ where: { storeId, createdAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 8, select: { id:true,total:true,currency:true,status:true,channel:true,posCustomerName:true,createdAt:true,items:{select:{quantity:true}} } }),
    prisma.booking.count({ where: { storeId, scheduledAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } } }),
    prisma.inventoryItem.findMany({ where: { storeId }, select: { quantity:true, lowStockThreshold:true, costPrice:true, product:{select:{name:true,isPublished:true}} } }),
    prisma.product.count({ where: { storeId, type: "PHYSICAL" } }),
  ]);
  const revenue = orders.reduce((sum,o)=>sum+Number(o.total),0);
  const stockValue = inventory.reduce((sum,i)=>sum+(i.costPrice==null?0:Number(i.costPrice)*i.quantity),0);
  const outOfStock = inventory.filter(i=>i.quantity===0).length;
  const lowStock = inventory.filter(i=>i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const now = new Date();
  const inSevenDays = new Date(now); inSevenDays.setDate(inSevenDays.getDate()+7);
  const fifoBatches = await prisma.inventoryBatch.findMany({
    where: { storeId, quantityRemaining: { gt: 0 } },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    take: 100,
    select: { id:true, batchNumber:true, quantityRemaining:true, unitCost:true, receivedAt:true, expiryDate:true, inventoryItem:{select:{product:{select:{name:true}}}}, variant:{select:{label:true,product:{select:{name:true}}}} },
  });
  const expiringSoon = fifoBatches.filter(b=>b.expiryDate && b.expiryDate >= now && b.expiryDate <= inSevenDays).length;
  const expired = fifoBatches.filter(b=>b.expiryDate && b.expiryDate < now).length;
  const fifoValue = fifoBatches.reduce((sum,b)=>sum+(b.unitCost==null?0:Number(b.unitCost)*b.quantityRemaining),0);
  return { storeName: access.store.name, orders, reservations, menuItems, revenue, stockValue, lowStock, outOfStock, fifo: { batchCount: fifoBatches.length, expiringSoon, expired, value: fifoValue, oldest: fifoBatches.slice(0,5) } };
}

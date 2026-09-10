import { prisma } from "@/lib/prisma";

type Event = { type: string; storeId: string; data?: Record<string, unknown> };
type Action = { type: "NOTIFY_OWNER" | "CREATE_APPROVAL" | "LOG_ACTIVITY"; title?: string; body?: string; requestType?: string };

function matches(conditions: unknown, data: Record<string, unknown>) {
  if (!conditions) return true;
  if (!Array.isArray(conditions)) return true;
  return conditions.every((c: any) => data[c.field] === c.equals);
}

/** Execute only allow-listed internal actions. Never accept arbitrary URLs/code from automation JSON. */
export async function runAutomationsForEvent(event: Event) {
  const automations = await prisma.automation.findMany({ where: { storeId: event.storeId, trigger: event.type, status: "ACTIVE" } });
  const results = [];
  for (const automation of automations) {
    const run = await prisma.automationRun.create({ data: { storeId: event.storeId, automationId: automation.id, status: "RUNNING", event: event as any } });
    try {
      if (!matches(automation.conditions, event.data ?? {})) {
        await prisma.automationRun.update({ where: { id: run.id }, data: { status: "SKIPPED", finishedAt: new Date(), result: { reason: "conditions_not_met" } } });
        results.push({ id: automation.id, status: "SKIPPED" }); continue;
      }
      const actions = Array.isArray(automation.actions) ? automation.actions as Action[] : [];
      const result: string[] = [];
      const store = await prisma.store.findUnique({ where: { id: event.storeId }, select: { business: { select: { userId: true } } } });
      if (!store) throw new Error("Store not found");
      for (const action of actions) {
        if (action.type === "NOTIFY_OWNER") {
          await prisma.notification.create({ data: { userId: store.business.userId, type: "AUTOMATION", title: action.title ?? automation.name, body: action.body ?? `Automation triggered by ${event.type}.`, url: `/admin/automations` } });
          result.push("NOTIFY_OWNER");
        } else if (action.type === "CREATE_APPROVAL") {
          await prisma.approvalRequest.create({ data: { storeId: event.storeId, title: action.title ?? automation.name, requestType: action.requestType ?? event.type, metadata: event.data as any } });
          result.push("CREATE_APPROVAL");
        } else if (action.type === "LOG_ACTIVITY") {
          await prisma.storeActivityLog.create({ data: { storeId: event.storeId, actorUserId: store.business.userId, actorName: "BizNest Automation", actorEmail: "system", actorRole: "SYSTEM", action: action.title ?? automation.name, metadata: event.data as any } });
          result.push("LOG_ACTIVITY");
        }
      }
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "SUCCESS", finishedAt: new Date(), result } });
      results.push({ id: automation.id, status: "SUCCESS" });
    } catch (error) {
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: error instanceof Error ? error.message : "Automation failed" } });
      results.push({ id: automation.id, status: "FAILED" });
    }
  }
  return results;
}

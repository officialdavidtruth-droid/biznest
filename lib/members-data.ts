import { prisma } from "@/lib/prisma";
import { chargeState, membershipState, summariseCharges, givingSummary } from "@/lib/members";

/** Everything the members workspace shows, serialisable (no Dates/Decimals) so it can cross to a client component. */
export async function loadMembersWorkspace(storeId: string) {
  const now = new Date();
  const [members, plans, charges, gifts, checkIns] = await Promise.all([
    prisma.member.findMany({ where: { storeId }, orderBy: { name: "asc" }, take: 500, include: { memberships: { include: { plan: { select: { name: true, kind: true } } }, orderBy: { startsAt: "desc" }, take: 5 } } }),
    prisma.memberPlan.findMany({ where: { storeId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.memberCharge.findMany({ where: { storeId, memberId: { not: null }, status: { not: "VOID" } }, orderBy: { dueDate: "desc" }, take: 600 }),
    prisma.memberCharge.findMany({ where: { storeId, kind: "GIVING", status: "PAID" }, orderBy: { paidAt: "desc" }, take: 2000, select: { id: true, fund: true, amount: true, paidAt: true, donorName: true, receiptNo: true, member: { select: { name: true } } } }),
    prisma.memberCheckIn.findMany({ where: { storeId }, orderBy: { at: "desc" }, take: 30, include: { member: { select: { name: true } } } }),
  ]);
  const byMember = new Map<string, typeof charges>();
  for (const c of charges) { if (!c.memberId) continue; const l = byMember.get(c.memberId) ?? []; l.push(c); byMember.set(c.memberId, l); }
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const rows = members.map((m) => {
    const mc = byMember.get(m.id) ?? [];
    const sum = summariseCharges(mc.map((c) => ({ status: c.status, amount: Number(c.amount), dueDate: c.dueDate })), now);
    return {
      id: m.id, name: m.name, email: m.email, phone: m.phone, notes: m.notes, active: m.active, portalToken: m.portalToken,
      owing: sum.outstanding, overdue: sum.overdue,
      memberships: m.memberships.map((ms) => ({ id: ms.id, planName: ms.plan.name, kind: ms.plan.kind, status: ms.status, state: membershipState(ms, now), renewsAt: iso(ms.renewsAt), endsAt: iso(ms.endsAt), sessionsLeft: ms.sessionsLeft })),
      charges: mc.slice(0, 24).map((c) => ({ id: c.id, label: c.label, kind: c.kind, amount: Number(c.amount), status: c.status, state: chargeState({ status: c.status, dueDate: c.dueDate, amount: Number(c.amount) }, now), dueDate: c.dueDate.toISOString(), paidAt: iso(c.paidAt), receiptNo: c.receiptNo, method: c.method })),
    };
  });
  const totals = rows.reduce((t, r) => ({ owing: t.owing + r.owing, overdue: t.overdue + r.overdue }), { owing: 0, overdue: 0 });
  return {
    members: rows,
    plans: plans.map((p) => ({ id: p.id, name: p.name, kind: p.kind, price: Number(p.price), interval: p.interval, sessions: p.sessions, validityDays: p.validityDays, description: p.description, active: p.active })),
    giving: { ...givingSummary(gifts.map((g) => ({ fund: g.fund, amount: Number(g.amount), paidAt: g.paidAt }))), recent: gifts.slice(0, 20).map((g) => ({ id: g.id, fund: g.fund ?? "General", amount: Number(g.amount), paidAt: iso(g.paidAt), who: g.member?.name ?? g.donorName ?? "Anonymous", receiptNo: g.receiptNo })) },
    checkIns: checkIns.map((c) => ({ id: c.id, who: c.member.name, at: c.at.toISOString(), usedSession: c.usedSession })),
    totals,
  };
}
export type MembersWorkspaceData = Awaited<ReturnType<typeof loadMembersWorkspace>>;
